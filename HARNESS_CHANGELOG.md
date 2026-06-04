# HARNESS_CHANGELOG.md

A running log of improvements to the *build harness* (docs, sensors, prompts, scripts) — not the game. When the same class of problem appears twice during a build, agents follow Inform → Verify → Correct (see `CLAUDE.md`) and log it here. The planner reads recent entries when decomposing the next epic, so lessons carry forward.

Format:

```
## YYYY-MM-DD — [Inform|Verify|Correct]: short description
**Trigger:** what happened (and that it happened ≥2×)
**Change:** what was added/modified
**Files:** paths touched
```

---

## 2026-06-03 — Inform: harness seeded
**Trigger:** initial creation of the build kit.
**Change:** established CLAUDE.md, docs/ (EPICS, ORCHESTRATION, ways-of-working, architecture, conventions, content-and-tuning, game-design-rigour, testing, minigames), the agent prompts, the Docker build box, and preflight.
**Files:** repo skeleton.

## 2026-06-04 — Correct: never `| grep -q` (or `| head`) under `set -o pipefail`
**Trigger:** appeared ≥2×. (1) The task skip-check `git log --merges … | grep -qF "$BRANCH"` made the container rebuild every already-merged E1 task; (2) `touches_design` had the identical shape and could silently skip the game-design review. `grep -q` exits on first match and SIGPIPEs the upstream producer (exit 141); under `set -euo pipefail` that 141 becomes the pipeline's status, so the `if` reads "failure". Invisible on dev machines whose interactive shell has no `pipefail`; only bites in the container.
**Change:** capture the producer's output into a variable first, then match with `grep -q … <<<"$var"` — no pipe, so no SIGPIPE. Guarded the remaining `| head -n1` sidecar read with `|| true`. Verified all 7 E1 tasks skip under `set -euo pipefail` inside the container image.
**Files:** scripts/agents/run-epic.sh, scripts/agents/lib/common.sh
