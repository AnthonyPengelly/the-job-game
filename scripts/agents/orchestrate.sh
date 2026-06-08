#!/usr/bin/env bash
# orchestrate.sh — the big-bang build. Walks epics in dependency order and runs
# the per-epic pipeline for each. Resumable: skips epics whose acceptance is
# already recorded and tasks already merged. See docs/ORCHESTRATION.md §3.
#
# Usage:
#   ./scripts/agents/orchestrate.sh                 # all epics, dependency order
#   ./scripts/agents/orchestrate.sh E0 E1 E2        # a subset, in given order
#   START_AT=E5 ./scripts/agents/orchestrate.sh     # resume from an epic

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
source scripts/agents/lib/common.sh

# Dependency-ordered epic sequence (critical path then fan-out). See docs/EPICS.md.
# IMPORTANT: when you add an epic to docs/EPICS.md you MUST also append its ID here,
# in dependency order, or the big-bang build will never pick it up. E12 (optional
# offline build) is deliberately last. The E14–E20 playtest-feedback wave follows E13.
DEFAULT_ORDER=(E0 E1 E2 E3 E4 E5 E6 E7 E8 E9 E10 E11 E13 E14 E15 E16 E17 E18 E19 E20 E12)

if [ "$#" -gt 0 ]; then
  ORDER=("$@")
else
  ORDER=("${DEFAULT_ORDER[@]}")
fi

# Safety net: warn about epics defined in docs/EPICS.md but absent from DEFAULT_ORDER,
# so a future agent that adds an epic to the backlog but forgets to wire it here gets a
# loud heads-up instead of a silently-skipped epic. Non-fatal (subset runs are valid).
if [ -f docs/EPICS.md ]; then
  for doc_epic in $(grep -oE '^## E[0-9]+' docs/EPICS.md | awk '{print $2}'); do
    case " ${DEFAULT_ORDER[*]} " in
      *" $doc_epic "*) ;;
      *) err "WARNING: $doc_epic is in docs/EPICS.md but missing from DEFAULT_ORDER in $(basename "$0") — it will NOT be built. Append it in dependency order." ;;
    esac
  done
fi

DONE_DIR=".orchestrator/done"
mkdir -p "$DONE_DIR"

started=0
for EPIC in "${ORDER[@]}"; do
  if [ -n "${START_AT:-}" ] && [ "$started" -eq 0 ]; then
    [ "$EPIC" = "$START_AT" ] && started=1 || { log "skip $EPIC (before START_AT=$START_AT)"; continue; }
  fi

  if [ -f "${DONE_DIR}/${EPIC}" ]; then
    log "epic $EPIC already complete (marker present); skipping"
    continue
  fi

  log "################  BUILDING $EPIC  ################"
  # Pull latest before each epic so harness fixes pushed mid-run are picked up.
  git pull --ff-only origin main 2>/dev/null || true
  if scripts/agents/run-epic.sh "$EPIC"; then
    date -u +"%Y-%m-%dT%H:%M:%SZ" >"${DONE_DIR}/${EPIC}"
    git add "${DONE_DIR}/${EPIC}" && git commit -m "chore(orchestrator): $EPIC complete"
    # Retry push with a pull-rebase in case main moved while the epic was running.
    git push origin main || (git pull --rebase origin main && git push origin main)
    log "################  $EPIC COMPLETE  ################"
  else
    code=$?
    err "epic $EPIC failed/paused (exit $code). Stopping big-bang; resume with START_AT=$EPIC after resolving."
    exit "$code"
  fi
done

log "ALL EPICS COMPLETE. Hand off to human playtest."
