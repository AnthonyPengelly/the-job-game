#!/usr/bin/env bash
# common.sh — shared helpers for The Job build pipeline.
# Sourced by orchestrate.sh, run-epic.sh, preflight.sh.
# No side effects on source beyond defining functions and defaults.

set -euo pipefail

# ---------------------------------------------------------------------------
# Config & defaults (override via env / .env)
# ---------------------------------------------------------------------------
: "${MODEL_PLAN:=}"        # strongest model (e.g. Opus). Empty = claude CLI default.
: "${MODEL_BUILD:=}"       # mid model (e.g. Sonnet)
: "${MODEL_REVIEW:=}"      # mid model
: "${MODEL_QA:=}"          # mid model
: "${MODEL_PARSE:=claude-haiku-4-5-20251001}"  # marker extraction (cheapest capable model)
: "${MAX_REVIEW_ROUNDS:=5}"
: "${MAX_QA_ROUNDS:=3}"
: "${PIPELINE_LOG_DIR:=pipeline-logs}"
: "${PROMPT_DIR:=scripts/agents/prompts}"
: "${CLAUDE_BIN:=claude}"  # over/wrapped in the container (see Dockerfile.agent)

mkdir -p "$PIPELINE_LOG_DIR"

log()  { printf '\033[1;34m[orch]\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33m[orch]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[orch]\033[0m %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# Marker extraction. The ONLY inter-step protocol (see docs/ORCHESTRATION.md §5).
#
# parse_markers <txt-file> calls Haiku to extract all PIPELINE_* markers from
# free-form agent output into a JSON sidecar (<file>.markers.json). This makes
# parsing robust against markdown formatting (backticks, bold, indentation, etc.).
# Sidecar format: {"PIPELINE_BRANCH":"epic/E0.1","PIPELINE_STATUS":"LGTM",...}
#
# extract_marker / has_status_* / has_blocked read the sidecar when present,
# and fall back to line-oriented grep on the raw file otherwise.
# ---------------------------------------------------------------------------
parse_markers() {  # parse_markers <txt-file>
  local file="$1"
  local sidecar="${file}.markers.json"
  local prompt
  prompt="$(cat <<'PROMPT'
Extract every PIPELINE_* marker from the text below. A marker is a key:value
pair where the key starts with PIPELINE_ (e.g. PIPELINE_BRANCH, PIPELINE_STATUS,
PIPELINE_BLOCKED, PIPELINE_PLAN_DONE). The value follows the colon. The marker
may appear anywhere — inline, in backticks, bold, a code block, mid-sentence.
Take the LAST occurrence of each key.
Output ONLY a single-line JSON object mapping each found key to its trimmed
string value. If no markers are found output {}.
Text:
PROMPT
)"
  # Append the agent output to the prompt
  local full_prompt="${prompt}
$(cat "$file")"

  "$CLAUDE_BIN" --print --model "$MODEL_PARSE" \
    --permission-mode bypassPermissions \
    "$full_prompt" 2>/dev/null \
    | grep -o '{.*}' | tail -n1 > "$sidecar" || true

  # If Haiku produced nothing usable, write an empty object so helpers still work
  [ -s "$sidecar" ] || echo '{}' > "$sidecar"
}

_sidecar_get() {  # _sidecar_get <txt-file> <KEY> — read one key from sidecar JSON
  local sidecar="${1}.markers.json"
  [ -f "$sidecar" ] || return 1
  # Simple sed extraction — avoids a jq dependency
  sed -n "s/.*\"${2}\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$sidecar" | head -n1
}

extract_marker() {  # extract_marker <file> <MARKER_NAME>
  local file="$1" name="$2"
  local val
  val="$(_sidecar_get "$file" "$name" 2>/dev/null)" && [ -n "$val" ] && { echo "$val"; return; }
  # Fallback: grep raw output
  grep -E "^${name}:" "$file" 2>/dev/null | tail -n1 | sed -E "s/^${name}:[[:space:]]*//" || true
}

has_status_lgtm() {
  local val; val="$(_sidecar_get "$1" PIPELINE_STATUS 2>/dev/null)" \
    && [ "$val" = "LGTM" ] && return 0
  grep -Eq '^PIPELINE_STATUS:[[:space:]]*LGTM$' "$1" 2>/dev/null
}
has_status_issues() {
  local val; val="$(_sidecar_get "$1" PIPELINE_STATUS 2>/dev/null)" \
    && [ "$val" = "ISSUES" ] && return 0
  grep -Eq '^PIPELINE_STATUS:[[:space:]]*ISSUES$' "$1" 2>/dev/null
}
has_blocked() {
  local val; val="$(_sidecar_get "$1" PIPELINE_BLOCKED 2>/dev/null)" \
    && [ -n "$val" ] && return 0
  grep -Eq '^PIPELINE_BLOCKED:' "$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# claude -p invocation. One fresh context per call. Model chosen per role.
# Usage: run_agent <label> <model> <prompt-string>   [stdin ignored]
# Writes raw output to $PIPELINE_LOG_DIR/<label>.txt and echoes that path.
# Handles rate-limit: detect, parse reset, sleep, retry (bounded).
# ---------------------------------------------------------------------------
run_agent() {  # run_agent <label> <model> <prompt>
  local label="$1" model="$2" prompt="$3"
  local out="${PIPELINE_LOG_DIR}/${label}.txt"
  local model_flag=()
  [ -n "$model" ] && model_flag=(--model "$model")

  local attempt=0 max_attempts="${RATE_LIMIT_RETRIES:-6}"
  while : ; do
    attempt=$((attempt+1))
    log "agent[$label] model=${model:-default} (attempt $attempt)"
    # --print = headless; --permission-mode bypassPermissions = container is isolated;
    # --dangerously-skip-permissions is the bypass flag for the sandboxed build box.
    if "$CLAUDE_BIN" --print "${model_flag[@]}" \
         --permission-mode bypassPermissions \
         "$prompt" >"$out" 2>>"${PIPELINE_LOG_DIR}/${label}.stderr"; then
      :
    else
      warn "agent[$label] exited non-zero; inspecting output"
    fi

    if grep -qiE "(rate limit|you've hit your limit|usage limit)" "$out"; then
      if [ "$attempt" -ge "$max_attempts" ]; then
        err "agent[$label] rate-limited and out of retries"; echo "$out"; return 1
      fi
      local secs; secs="$(parse_rate_limit_sleep "$out")"
      warn "agent[$label] rate-limited; sleeping ${secs}s then retrying"
      sleep "$secs"; continue
    fi
    break
  done
  parse_markers "$out"
  echo "$out"
}

# Parse a reset time from rate-limit text → seconds to sleep. Falls back to 900s.
parse_rate_limit_sleep() {  # parse_rate_limit_sleep <file>
  local file="$1"
  # Try "resets at HH:MMam/pm" style; else default.
  local reset
  reset="$(grep -oiE 'resets? (at )?[0-9]{1,2}(:[0-9]{2})?[[:space:]]*(am|pm)?' "$file" | head -n1 || true)"
  if [ -n "$reset" ]; then
    # Best-effort: sleep a fixed safe window; precise parsing is brittle across locales.
    echo "$(( ${RATE_LIMIT_DEFAULT_SLEEP:-900} ))"
  else
    echo "${RATE_LIMIT_DEFAULT_SLEEP:-900}"
  fi
}

# ---------------------------------------------------------------------------
# Prompt builder: read a prompt template and substitute {{VARS}}.
# Usage: render_prompt <template-file> KEY=VAL KEY=VAL ...
# ---------------------------------------------------------------------------
render_prompt() {  # render_prompt <file> <k=v>...
  local file="$1"; shift
  local content; content="$(cat "$PROMPT_DIR/$file")"
  local pair k v
  for pair in "$@"; do
    k="${pair%%=*}"; v="${pair#*=}"
    # escape for sed replacement
    v="$(printf '%s' "$v" | sed -e 's/[\/&]/\\&/g')"
    content="$(printf '%s' "$content" | sed -E "s/\{\{${k}\}\}/${v}/g")"
  done
  printf '%s' "$content"
}

# ---------------------------------------------------------------------------
# Deterministic gates (free, fast). Run before any reviewer.
# Returns 0 if all pass, non-zero otherwise; output captured for the fixer.
# ---------------------------------------------------------------------------
run_deterministic_gates() {  # run_deterministic_gates <gate-log>
  local gatelog="$1"; : >"$gatelog"
  local ok=0
  for cmd in "npm run check:full" "npm run sim:check" "npm run content:validate"; do
    log "gate: $cmd"
    if ! bash -lc "$cmd" >>"$gatelog" 2>&1; then
      warn "gate failed: $cmd"; ok=1
    fi
  done
  return $ok
}

# ---------------------------------------------------------------------------
# Git helpers (merge is deterministic — never done by an agent).
# ---------------------------------------------------------------------------
merge_branch() {  # merge_branch <branch> <into>
  local branch="$1" into="${2:-main}"
  git checkout "$into"
  git merge --no-ff --no-edit "$branch"
  git push origin "$into"
}

# Does the diff touch design-bearing code? (decides whether game-design review runs)
touches_design() {  # touches_design <branch> <base>
  local branch="$1" base="${2:-main}"
  git diff --name-only "${base}...${branch}" | grep -Eq '^(src/engine|src/content|src/minigames|presets)/' || return 1
}
