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
DEFAULT_ORDER=(E0 E1 E2 E3 E4 E5 E6 E7 E8 E9 E10 E11 E12)

if [ "$#" -gt 0 ]; then
  ORDER=("$@")
else
  ORDER=("${DEFAULT_ORDER[@]}")
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
