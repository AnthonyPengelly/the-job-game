#!/usr/bin/env bash
# run-epic.sh — run the full pipeline for a single epic.
# Usage: ./scripts/agents/run-epic.sh E3
# Stages: plan -> per-task (build -> gates -> reviews -> fix loop -> merge) -> epic QA.
# See docs/ORCHESTRATION.md.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
source scripts/agents/lib/common.sh

EPIC="${1:?usage: run-epic.sh <EPIC e.g. E3>}"
log "==== EPIC $EPIC ===="

# ---- 1. PLAN (once per epic, strongest model) -----------------------------
PLAN_FILE="plans/${EPIC}.md"
# Check origin/main first (survives container restarts; local clone may be stale).
mkdir -p "$(dirname "$PLAN_FILE")"
if ! git fetch origin main || ! git show "origin/main:${PLAN_FILE}" >"$PLAN_FILE" 2>/dev/null; then
  prompt="$(render_prompt planner.md EPIC="$EPIC")"
  out="$(run_agent "plan-${EPIC}" "$MODEL_PLAN" "$prompt")"
  if has_blocked "$out"; then err "planner blocked: $(extract_marker "$out" PIPELINE_BLOCKED)"; exit 2; fi
  # Pull so the orchestrator process sees the file the planner committed and pushed.
  git pull --ff-only origin main 2>/dev/null || true
  [ -f "$PLAN_FILE" ] || { err "planner did not commit $PLAN_FILE to main"; exit 2; }
  log "plan written: $PLAN_FILE"
else
  log "plan already on origin/main: $PLAN_FILE"
fi

# ---- 2. Extract task ids (E<n>.<k>) from the plan --------------------------
mapfile -t TASKS < <(grep -oE "^#+[[:space:]]*Task[[:space:]]+${EPIC}\.[0-9]+" "$PLAN_FILE" \
                     | grep -oE "${EPIC}\.[0-9]+" | sort -u -t. -k2 -n)
[ "${#TASKS[@]}" -gt 0 ] || { err "no tasks found in $PLAN_FILE"; exit 2; }
log "tasks: ${TASKS[*]}"

# ---- 3. Per-task build/review/merge loop ----------------------------------
for TASK in "${TASKS[@]}"; do
  BRANCH="epic/${TASK}"
  log "---- task $TASK (branch $BRANCH) ----"

  # already merged? skip (resumability)
  # Check whether the remote branch tip is already reachable from origin/main.
  # This is robust to all three cases:
  #   1. Normal --no-ff merge: branch tip is a parent of the merge commit → reachable.
  #   2. Rebased merge (git pull --rebase on push-rejection): the individual commits
  #      are replayed on main, so after force-updating the remote branch to the
  #      replayed commit it's again reachable.
  #   3. Branch doesn't exist yet: fetch fails, grep won't find it, falls through.
  # Deliberately NOT using `git log --merges` (or any subject-grep): a plain
  # `git pull --rebase` on push-rejection linearises/skips the merge commit so its
  # "Merge branch 'X'" subject never lands in main's log. (This is what caused E5.4
  # to be rebuilt on restart despite its content already being on main.)
  git fetch origin "${BRANCH}" 2>/dev/null || true
  if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}" \
     && git merge-base --is-ancestor "origin/${BRANCH}" origin/main 2>/dev/null; then
    log "task $TASK already merged; skipping"; continue
  fi

  # BUILD
  prompt="$(render_prompt builder.md EPIC="$EPIC" TASK="$TASK" PLAN_FILE="$PLAN_FILE" BRANCH="$BRANCH")"
  out="$(run_agent "build-${TASK}-0" "$MODEL_BUILD" "$prompt")"
  if has_blocked "$out"; then err "builder blocked on $TASK: $(extract_marker "$out" PIPELINE_BLOCKED)"; exit 3; fi
  branch="$(extract_marker "$out" PIPELINE_BRANCH)"
  [ -n "$branch" ] || { err "builder produced no branch for $TASK"; exit 3; }
  git fetch origin "$branch":"$branch" 2>/dev/null || git checkout "$branch"

  # REVIEW GATE (loop). Once a reviewer returns LGTM we don't pay to re-run it on
  # later rounds: the fixer only addresses the *other* reviewer's findings, and the
  # deterministic gates (which DO re-run every round) catch any test/type/lint
  # regression a fix might introduce. This is the main lever against review churn —
  # before, both reviewers re-ran in full every round even after passing.
  round=0; approved=0; code_passed=0; design_passed=0
  while [ "$round" -lt "$MAX_REVIEW_ROUNDS" ]; do
    round=$((round+1))
    findings="${PIPELINE_LOG_DIR}/findings-${TASK}-${round}.txt"; : >"$findings"

    # deterministic gates first (free) — always, every round
    if ! run_deterministic_gates "${PIPELINE_LOG_DIR}/gates-${TASK}-${round}.txt"; then
      echo "DETERMINISTIC GATES FAILED:" >>"$findings"
      cat "${PIPELINE_LOG_DIR}/gates-${TASK}-${round}.txt" >>"$findings"
    else
      # code reviewer — run until it passes once, then skip on later rounds
      if [ "$code_passed" -eq 0 ]; then
        cr="$(render_prompt reviewer.md TASK="$TASK" BRANCH="$branch" ROUND="$round")"
        cro="$(run_agent "review-code-${TASK}-${round}" "$MODEL_REVIEW" "$cr")"
        if has_status_issues "$cro"; then { echo "CODE REVIEW:"; cat "$cro"; } >>"$findings"; else code_passed=1; fi
      fi

      # game-design reviewer — only if design-bearing source changed, and only
      # until it passes once
      if [ "$design_passed" -eq 0 ] && touches_design "$branch"; then
        gr="$(render_prompt game-design-reviewer.md TASK="$TASK" BRANCH="$branch" ROUND="$round")"
        gro="$(run_agent "review-design-${TASK}-${round}" "$MODEL_REVIEW" "$gr")"
        if has_status_issues "$gro"; then { echo "GAME-DESIGN REVIEW:"; cat "$gro"; } >>"$findings"; else design_passed=1; fi
      fi
    fi

    if [ ! -s "$findings" ]; then approved=1; break; fi

    # FIX
    log "task $TASK round $round: issues found; dispatching fixer"
    fx="$(render_prompt fixer.md TASK="$TASK" BRANCH="$branch" FINDINGS_FILE="$findings" ROUND="$round")"
    fxo="$(run_agent "fix-${TASK}-${round}" "$MODEL_BUILD" "$fx")"
    if has_blocked "$fxo"; then err "fixer blocked on $TASK: $(extract_marker "$fxo" PIPELINE_BLOCKED)"; exit 3; fi
    git fetch origin "$branch":"$branch" 2>/dev/null || true
  done

  [ "$approved" -eq 1 ] || { err "task $TASK exhausted $MAX_REVIEW_ROUNDS review rounds"; exit 4; }

  # MERGE (deterministic)
  merge_branch "$branch" main
  log "PIPELINE_DONE: $branch"
done

# ---- 4. EPIC QA (Playwright MCP, bounded fix loop) ------------------------
qa_round=0
while [ "$qa_round" -lt "$MAX_QA_ROUNDS" ]; do
  qa_round=$((qa_round+1))
  qp="$(render_prompt qa.md EPIC="$EPIC" ROUND="$qa_round")"
  qo="$(run_agent "qa-${EPIC}-${qa_round}" "$MODEL_QA" "$qp")"
  if has_status_lgtm "$qo"; then
    log "EPIC $EPIC QA: LGTM"
    # Write the orchestrator done marker so orchestrate.sh skips this epic
    # even when run-epic.sh was invoked directly (e.g. RUN="epic E1").
    # NB: no `local` here — this is top-level script scope, not a function;
    # `local` outside a function aborts the script under `set -e`.
    done_dir=".orchestrator/done"
    mkdir -p "$done_dir"
    date -u +"%Y-%m-%dT%H:%M:%SZ" >"${done_dir}/${EPIC}"
    git add "${done_dir}/${EPIC}" && git commit -m "chore(orchestrator): $EPIC complete" \
      && { git push origin main || (git pull --rebase origin main && git push origin main); } \
      || true  # marker is best-effort; don't fail the epic if push is flaky
    exit 0
  fi
  if has_blocked "$qo"; then err "QA blocked: $(extract_marker "$qo" PIPELINE_BLOCKED)"; exit 5; fi
  # QA found issues -> a fix task on a branch, then re-QA
  warn "EPIC $EPIC QA round $qa_round: issues; dispatching fixer"
  fb="epic/${EPIC}-qa-fix-${qa_round}"
  fx="$(render_prompt fixer.md TASK="${EPIC}-qa" BRANCH="$fb" FINDINGS_FILE="$qo" ROUND="$qa_round")"
  fxo="$(run_agent "qa-fix-${EPIC}-${qa_round}" "$MODEL_BUILD" "$fx")"
  branch="$(extract_marker "$fxo" PIPELINE_BRANCH)"
  [ -n "$branch" ] && run_deterministic_gates "${PIPELINE_LOG_DIR}/qa-gates-${EPIC}-${qa_round}.txt" \
    && merge_branch "$branch" main
done

err "EPIC $EPIC QA exhausted $MAX_QA_ROUNDS rounds"; exit 5
