# CLAUDE.md — The Job

> This is the agent map. It is intentionally short. Deep guidance lives in `docs/`.
> If something isn't covered here or in `docs/`, **stop and ask the human** — do not guess.

## What this is

**The Job** is a co-op heist party game. The deliverable is an **offline single-page web app** (React + Vite + TypeScript) that one person — the **Game Master (GM)** — runs on a laptop to drive a whole heist run for 2–7 players. The crew plays with physical cards at a table; the laptop is the rulebook, the narrator, the soundboard, and the bookkeeper.

The game's design is fixed and lives in two source-of-truth documents (do not contradict them):

- `docs/design/heist-game-design.md` — the full game design (the run, Heat, the ten mini-games, the Getaway, scaling).
- `docs/design/heist-content.md` — the content library (gear, 44 scenarios).
- `docs/design/the-job-app-design.md` — the software architecture and the review decisions (v0.2).

## Golden rules (always active)

1. **The GM is in charge; the app assists and never blocks.** Every tracked value (Heat, Loot, stats, power-ups, exhaustion, outcomes, phase) must be GM-editable at any time. **No dead-ends** — any state the engine reaches, the GM can edit out of. "Undo last" on every mutation.
2. **Engine is pure.** The rules engine (`src/engine`) is framework-agnostic TypeScript: `(state, event) -> state`. No React, no DOM, no timers, no audio, no `Math.random` (use the seeded RNG). It is the same code as the balance simulation.
3. **Content, rules, tuning and scaling are data, not code.** They live in **presets** (`presets/`) loaded at boot and swappable without a rebuild. See `docs/CONTENT-AND-TUNING.md`. Never hardcode a tunable number in the engine.
4. **Determinism.** All randomness flows through one seeded RNG. Same seed + same inputs ⇒ same run. This is what makes the game testable.
5. **Mini-games are plugins behind one contract** (`MiniGame`). Ten games, one shape. See `docs/MINIGAMES.md`.
6. **GM-facing first.** The console is for the GM only. The **player-view** surface (`src/player-view`) is a deliberate, isolated exception (Defuse the Alarm's rulebook, optional Getaway display). It must never leak GM-only state.
7. **Parse at the boundary.** All external/loaded data (presets, persisted state) is validated with Zod before use. Malformed content fails loudly, never silently at the table.
8. **Tests + balance are mandatory.** Every engine function has unit tests. The balance harness (`npm run sim:check`) must pass against the default preset. Sensors must pass before a task is "done" (`npm run check:full`).
9. **TypeScript strict.** No `any`, no `@ts-ignore`, no unjustified `as`.
10. **Small, coherent tasks.** One task = one branch = one PR-sized change. Don't sprawl across epics.
11. **Document decisions.** New architectural choice not in `docs/`? Add it. The repo is the system of record.

## Architecture in one breath

```
console (React)  ─ GM-facing UI: run shell, HUD, teleprompter, soundboard, mini-game referee screens
player-view      ─ isolated player-facing surface (Defuse rulebook, optional Getaway display)
minigames        ─ the MiniGame contract + shared primitives + 10 game modules
engine (pure TS) ─ run state machine, Heat model, generation, gear/crew, scaling, scoring, seeded RNG
content/presets  ─ scenarios, gear, narration, banks, tuning, scaling — as validated data
platform         ─ audio engine (Web Audio), persistence (localStorage), preset loader
```

One-way dependency flow: `engine → content → minigames → console/player-view`. Never import upward. The engine imports nothing from React.

Full detail: `docs/ARCHITECTURE.md`.

## The build is autonomous and multi-agent

This repo is built by an orchestrated pipeline of Claude Code agents running in Docker (bypass-permissions). You may be invoked as a **planner**, a **builder**, a **code reviewer**, a **game-design reviewer**, or a **QA agent**. Your role and its rules are in the prompt you were given and in `.claude/agents/`. The full pipeline — models per step, how reviews gate merges, how the QA fix-loop terminates — is in **`docs/ORCHESTRATION.md`**.

The work backlog is **`docs/EPICS.md`**: epics E0–E12 with stories, dependencies, and acceptance criteria. Build in dependency order. Ways of working (branching, commits, definition of done, the pipeline markers you must emit) are in **`docs/WAYS-OF-WORKING.md`**.

## When you get stuck

- **Design question?** Re-read the three `docs/design/*` files. They are authoritative. If still unclear, emit `PIPELINE_BLOCKED: <question>` rather than guessing.
- **Architecture question?** `docs/ARCHITECTURE.md`. If the answer isn't there, block — don't invent a new pattern.
- **Recurring issue (twice+)?** Don't just fix the instance. Improve the harness: update the relevant `docs/` guide, add a sensor, and log it in `HARNESS_CHANGELOG.md` (Inform → Verify → Correct).

## Docs index

| File | What |
|------|------|
| `docs/EPICS.md` | The build backlog: epics, stories, dependencies, acceptance criteria |
| `docs/ORCHESTRATION.md` | The multi-agent pipeline: roles, models, review gates, QA loop, big-bang run |
| `docs/WAYS-OF-WORKING.md` | Branching, commits, pipeline markers, definition of done |
| `docs/ARCHITECTURE.md` | Layers, module boundaries, dependency rules, the engine |
| `docs/CONVENTIONS.md` | Naming, file structure, TypeScript patterns |
| `docs/CONTENT-AND-TUNING.md` | Presets: content/tuning/scaling as swappable data |
| `docs/GAME-DESIGN-RIGOUR.md` | The balance harness and agent-led playtesting |
| `docs/TESTING.md` | Test strategy, the sim harness, Playwright QA |
| `docs/MINIGAMES.md` | The MiniGame contract, the ten games, solo/scaling variants |
| `docs/DESIGN-SYSTEM.md` | Visual design system: tokens, type, UI kits, offline-font setup, implementation checklist (E0 + E10) |
| `docs/design/*` | The fixed game design (do not contradict) |
