#!/usr/bin/env bash
# preflight.sh — validate the build rig WITHOUT building the app.
# Run this until green before ./orchestrate.sh. See docs/ORCHESTRATION.md §7.
#
# Usage: ./scripts/agents/preflight.sh            # checks 1-4 (no model spend)
#        SMOKE=1 ./scripts/agents/preflight.sh    # also run check 5 (one cheap agent call)

set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
source scripts/agents/lib/common.sh 2>/dev/null || { echo "run from repo root"; exit 1; }

PASS=0; FAIL=0
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
no()   { printf '\033[1;31m  ✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
sect() { printf '\n\033[1m%s\033[0m\n' "$*"; }

sect "1. Toolchain & auth"
command -v "$CLAUDE_BIN" >/dev/null && ok "claude CLI on PATH" || no "claude CLI missing"
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] || [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  ok "auth token present"; else no "no CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY"; fi
command -v git >/dev/null && ok "git present" || no "git missing"
command -v node >/dev/null && ok "node present ($(node -v 2>/dev/null))" || no "node missing"
if [ "${USE_GH:-0}" = "1" ]; then
  command -v gh >/dev/null && gh auth status >/dev/null 2>&1 && ok "gh authenticated" || no "gh not authenticated (USE_GH=1)"
fi

sect "2. Repo state"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 && ok "inside a git repo" || no "not a git repo"
[ -f CLAUDE.md ] && ok "CLAUDE.md present" || no "CLAUDE.md missing"
[ -f docs/EPICS.md ] && ok "docs/EPICS.md present" || no "docs/EPICS.md missing"
for p in planner builder reviewer game-design-reviewer qa fixer; do
  [ -f "$PROMPT_DIR/$p.md" ] && ok "prompt: $p.md" || no "prompt missing: $p.md"
done

sect "3. Marker parser self-test"
tmp="$(mktemp)"
printf 'noise\nPIPELINE_STATUS: ISSUES\nmore\nPIPELINE_BRANCH: epic/E3.2\n' >"$tmp"
[ "$(extract_marker "$tmp" PIPELINE_BRANCH)" = "epic/E3.2" ] && ok "extract_marker BRANCH" || no "extract_marker BRANCH"
has_status_issues "$tmp" && ok "has_status_issues" || no "has_status_issues"
printf 'PIPELINE_STATUS: LGTM\n' >"$tmp"
has_status_lgtm "$tmp" && ok "has_status_lgtm" || no "has_status_lgtm"
rm -f "$tmp"

sect "4. Playwright MCP"
if [ -f .mcp.json ] && grep -q playwright .mcp.json; then ok ".mcp.json declares playwright"; else no ".mcp.json missing playwright"; fi

sect "5. One-shot smoke agent (model spend)"
if [ "${SMOKE:-0}" = "1" ]; then
  scratch="preflight/smoke-$$"
  git checkout -b "$scratch" >/dev/null 2>&1 || true
  prompt="On the current git branch, append one line '<!-- preflight smoke OK -->' to README.md, commit it with message 'chore: preflight smoke', and emit on the final line: PIPELINE_BRANCH: ${scratch}"
  out="$(run_agent "preflight-smoke" "$MODEL_BUILD" "$prompt")"
  if [ "$(extract_marker "$out" PIPELINE_BRANCH)" = "$scratch" ]; then ok "smoke agent ran & emitted marker"; else no "smoke agent failed (see $out)"; fi
  git checkout - >/dev/null 2>&1 || true
  git branch -D "$scratch" >/dev/null 2>&1 || true
  git checkout README.md >/dev/null 2>&1 || true
else
  printf '  (skipped — set SMOKE=1 to run a real one-shot agent call)\n'
fi

sect "Result"
printf 'passed: %s   failed: %s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] && { echo "READY — preflight green. You may launch ./scripts/agents/orchestrate.sh"; exit 0; } \
                  || { echo "NOT READY — resolve the ✗ items above before the big bang."; exit 1; }
