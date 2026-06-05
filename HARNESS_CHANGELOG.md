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

## 2026-06-05 — Correct: leaner review loop (token-per-progress was too high)
**Trigger:** E0–E3 logs showed ~4.4 model calls/task dominated by review churn — both reviewers re-ran in full every fix round even after passing (147 code-review + 84 design-review calls across 29 tasks), the game-design reviewer fired on ~1 task in 1 even for test/type-only diffs, and `MAX_REVIEW_ROUNDS=5` allowed long nitpick tails.
**Change:** five trims. (1) A reviewer that returns LGTM is no longer re-run on later rounds — only the reviewer(s) that flagged issues re-run; deterministic gates still re-run every round to catch fix regressions. (2) Planner instructed to prefer 5–7 coherent tasks/epic and merge trivially-coupled work. (3) `touches_design` now strips `*.test.*`/`*.spec.*`/`__tests__/`/`*.d.ts` before deciding, so tests/types-only diffs skip the second reviewer. (4) `MAX_REVIEW_ROUNDS` 5→3. (5) Reviewer prompt no longer raises pure style/formatting/naming (owned by ESLint/Prettier) at any round. Docs + `.env.example` updated to match.
**Files:** scripts/agents/run-epic.sh, scripts/agents/lib/common.sh, scripts/agents/prompts/planner.md, scripts/agents/prompts/reviewer.md, docs/ORCHESTRATION.md, .env.example
