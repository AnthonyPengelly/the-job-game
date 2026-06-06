# The Job

An offline co-op heist party game for 2–7 players. One person runs this app (the **Game Master**, "the guy in the van") on a laptop; everyone else plays with physical cards at a table. The app is the rulebook, narrator, soundboard, and bookkeeper. ~30 minutes a run, different every time, trivial to learn.

This repository is **both** the app and the autonomous build harness that creates it.

## For the human

- **Play the game (offline, no server):** `npm install && npm run build` — then double-click `dist/index.html`. Use Chrome or Edge for full `localStorage` support. See [`docs/OFFLINE-BUILD.md`](docs/OFFLINE-BUILD.md) for the full procedure and browser caveats.
- **Develop the app:** `npm run dev` (hot-reload dev server on localhost).
- **Run the autonomous build:** see the operator run-book in [`docs/WAYS-OF-WORKING.md`](docs/WAYS-OF-WORKING.md). TL;DR: configure `.env`, `docker compose build agent`, run preflight until green, then `RUN=orchestrate docker compose run --rm agent`.

## The design (authoritative, fixed)

- [`docs/design/heist-game-design.md`](docs/design/heist-game-design.md) — the game.
- [`docs/design/heist-content.md`](docs/design/heist-content.md) — gear & the 44 scenarios.
- [`docs/design/the-job-app-design.md`](docs/design/the-job-app-design.md) — the app architecture & review decisions.

## How it's built

A pipeline of Claude Code agents runs in a Docker container and builds the app epic by epic: a planner decomposes each epic, builders implement task-by-task on branches, code + game-design reviewers and a Playwright QA agent gate every merge, and a balance simulation guards the game's feel. Cheap models do the bulk; the strongest model only plans. See [`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md) and the backlog in [`docs/EPICS.md`](docs/EPICS.md).

## Map

- [`CLAUDE.md`](CLAUDE.md) — the agent map and golden rules.
- [`docs/`](docs/) — architecture, conventions, content/tuning, testing, mini-games, orchestration.
- [`scripts/agents/`](scripts/agents/) — the pipeline scripts and prompts.
- [`presets/`](presets/) — content/tuning/scaling as swappable data (created during the build).

> Status: harness seeded; application not yet built. Run preflight, then the big bang.
