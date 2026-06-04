#!/usr/bin/env bash
# agent-entrypoint.sh — runs inside the agent container. Clones a FRESH copy of
# the repo from GitHub (state lives in git, never in the container), installs
# deps, then hands off to the orchestrator (or a single epic / preflight).
#
# Env (from docker-compose / .env):
#   GITHUB_REPO         e.g. youruser/the-job   (required)
#   GITHUB_TOKEN        push/pull credential     (required unless USE_GH=1 + gh auth)
#   GIT_USER_NAME, GIT_USER_EMAIL
#   CLAUDE_CODE_OAUTH_TOKEN | ANTHROPIC_API_KEY  (one required)
#   RUN                 "orchestrate" (default) | "epic E5" | "preflight"
set -euo pipefail

: "${GITHUB_REPO:?set GITHUB_REPO}"
git config --global user.name  "${GIT_USER_NAME:-the-job-agent}"
git config --global user.email "${GIT_USER_EMAIL:-agent@thejob.local}"

if [ -n "${GITHUB_TOKEN:-}" ]; then
  git config --global credential.helper store
  printf 'https://x-access-token:%s@github.com\n' "$GITHUB_TOKEN" > ~/.git-credentials
fi

# Fresh clone every run — no stale state.
rm -rf /workspace/repo
git clone "https://github.com/${GITHUB_REPO}.git" /workspace/repo
cd /workspace/repo

# Make claude resolve to the auth shim.
export CLAUDE_BIN="claude-agent"

# Install deps if a manifest exists (E0 creates package.json; before that it's a no-op).
[ -f package.json ] && npm install --no-audit --no-fund || true

echo "__PIPELINE_AGENT_START__"

RUN="${RUN:-orchestrate}"
case "$RUN" in
  preflight)  SMOKE="${SMOKE:-0}" ./scripts/agents/preflight.sh ;;
  epic\ *)    ./scripts/agents/run-epic.sh "${RUN#epic }" ;;
  orchestrate) ./scripts/agents/orchestrate.sh ;;
  *)          ./scripts/agents/orchestrate.sh ;;
esac
