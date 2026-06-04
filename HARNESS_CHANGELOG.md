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
