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

## 2026-06-11 — Inform: referee screens must assume the crew cannot see the console
**Trigger:** appeared across ≥4 of the ten mini-games during the human playtest review. Crack the Tumblers rendered every dealt value as on-screen tap buttons (collapsing the silent-coordination mechanic, with values undealable from a pack); The Once-Over highlighted the changed cards with an "amber edge · GM only" on the same screen the crew tapped, and rendered removals as self-identifying blanks; Defuse the Alarm drew its wires on the console with colours/symbols no pack has; Assembly Line hid which set-types to deal and offered no deck-build instructions at all.
**Change:** recorded two standing decisions at the top of `docs/MINIGAMES.md` §2 — (1) the game is pre-bound to the obstacle option (crew picks the players, not the game); (2) **the GM screen is GM-only**: anything the crew must see lives on the table or the player-view, referee screens carry setup instructions (deal-from-a-shuffle, never card-hunting) plus ✓/✗ recording controls. All affected games reworked to that shape; per-game specs and the §5 sensing table updated to match. Future game work (and the 11th-game checklist) inherits the constraint from the doc.
**Files:** docs/MINIGAMES.md, src/minigames/games/* (reworks), HARNESS_CHANGELOG.md
