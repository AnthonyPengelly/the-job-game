# EPICS.md — The Job build backlog

The authoritative work breakdown. The orchestrator builds these **in dependency order**. Each epic lists its goal, stories, dependencies, and a hard **acceptance gate** (what must be true to call it done). The planner agent turns each epic into numbered tasks; the builder implements task-by-task; reviewers gate each merge; a QA pass closes the epic. See `docs/ORCHESTRATION.md`.

Epic IDs are stable (`E0`–`E12`). Never renumber — scripts, branches (`epic/E5-...`), and reviews reference them.

---

## Dependency graph

```
E0 → E1 → E2 ┐
             ├→ E3 → E4 → E5
             │       ├→ E6
             │       ├→ E7
             │       ├→ E8
             │       └→ E9
             └──────────→ E10
E1 → E11   (anytime after engine)
all → E12  (last, optional)
```

Critical path: **E0 → E1 → E2 → E3 → E4 → E5**. E6–E9 fan out from E3/E4 and can be built in any order (or in parallel by separate agent runs). E10 needs E3. E11 needs E1. E12 is last.

---

## E0 — Foundations & scaffold

**Goal:** a runnable empty app and the full toolchain the pipeline depends on.

**Stories**
- Vite + React + TS project; strict `tsconfig`; path aliases (`@/engine`, `@/content`, …).
- ESLint + Prettier; the import-direction lint rule (engine may not import React/console).
- Vitest configured; one passing example test.
- The seeded RNG (`mulberry32` or similar) in `src/engine/rng.ts`, with tests proving reproducibility.
- Folder skeleton: `src/{engine,content,minigames,console,player-view,platform}`.
- `npm` scripts wired (even if some are stubs that later epics fill): `dev`, `build`, `check`, `check:full`, `sim:check`, `content:validate`, `test`, `lint`, `typecheck`.
- Design-token skeleton (CSS variables; dark "van" theme placeholder).

**Acceptance gate:** `npm run check:full` passes on an empty app; `npm run dev` serves a shell at localhost; RNG reproducibility test green; the import-direction lint rule actually fails when engine imports React (prove with a deleted-after test).

---

## E1 — Core rules engine

**Goal:** the pure, tested heart. The TS port of `docs/design/heat-model-simulation` logic, as the *same code that ships*.

**Stories**
- `RunState`, `RunEvent`, `reduce(state, event)` — pure, exhaustive, typed.
- Heat model: per-room drip, greedy surcharge, outcome Heat (clean/comp/botch), escalation ramp (~room 5+), escape signal (~Heat 11), forced Getaway at HMAX (20).
- Getaway resolution: Heat→(target, time)→odds, with crew-skill and headcount terms; win/bust; scoring with low-Heat style bonus.
- Room/scenario stream generation (procedural, seeded): obstacle option menus (game · reward · Heat cost), scenario draw without repeats, carried effects (ticking briefcase, 3-room unlock).
- All tunable numbers read from the **active preset**, never hardcoded (depends on the preset schema — co-develop the minimal loader here, full system in E10/E11 via `docs/CONTENT-AND-TUNING.md`).

**Acceptance gate:** unit tests cover every reducer branch; `npm run sim:check` runs the headless Monte Carlo over the default preset and **asserts** the design targets (median ~4–5 obstacles, runs past 10 rooms ≤ ~3%, win-rate bands by skill bad<avg<good, Loot roughly doubles poor→good). Numbers reproduce the reference model within tolerance.

---

## E2 — Crew, gear, scaling & GM overrides

**Goal:** track the crew and let the GM control everything.

**Stories**
- Player model: four lane stats, up to four power-ups (one per lane, no stack), starter quirk, exhaustion/rotation.
- Two reward layers: stacking stat boosts; the four lane power-ups. Gear assignment to a player.
- Scaling profiles (2–7) from the preset: exhaustion strength, crew-needed-per-option, per-game commit floors & dial curves.
- **GM override API on the engine:** typed events to set/adjust Heat, Loot, grant/remove any gear, set/clear exhaustion, force an outcome, re-roll/skip a room, jump phase. Every mutation is undoable (`UNDO_LAST`). **No engine state is a dead-end.**

**Acceptance gate:** property test — from any reachable `RunState`, every tracked field can be driven to any legal value via override events, and `UNDO_LAST` restores the prior state; scaling profiles deal correctly-sized jobs for n=2..7.

---

## E3 — Room loop & GM console shell (mini-games stubbed)

**Goal:** the whole run is playable end-to-end from the UI, with mini-games stubbed as a GM outcome-picker. First true playtest build.

**Stories**
- State store (Zustand) wrapping the pure engine; React renders from it.
- **Refresh-safe persistence at the store boundary:** write-through to `localStorage` after *every* engine event (save as `{ seed, eventLog }`); hydrate-on-boot before first render; schema-versioned + Zod-parsed (stale/mismatched save → loud fail + clean restart, never corruption). A hard refresh / tab close / crash mid-room reloads into the exact same state. (Leaderboard + visual polish are E10; this is just resume-survival, and it belongs here because it's a property of the store.)
- Screens: Setup (crew 2–7, names, quirks, seed; **Resume the job vs New job** when a save exists) → Briefing → Obstacle (clue, options, commit crew) → Scenario (choose, two-stage reveal stub) → Offer (push/run) → Getaway (stub) → Result → again.
- **Persistent HUD:** Heat track (0–20 face-down cards), Loot, crew gear/exhaustion.
- **Crew & gear direct-manipulation UI:** drag a dropped loot/gear card onto the player who takes it; HUD reflects holdings.
- **GM override surface:** always-available controls to edit Heat/Loot/gear/phase, plus "undo last".
- Mini-games stubbed: a "clean / complication / botched" picker that feeds the engine.

**Acceptance gate:** a human (or the QA agent) can play a complete run start→finish with only the stub picker; HUD always correct; every override works and undoes; no dead-end reachable (QA script asserts); **a hard browser refresh at any phase reloads into the identical state, and Setup offers Resume.**

---

## E4 — Mini-game framework + reference game

**Goal:** the `MiniGame` contract and shared primitives, proven by one real game.

**Stories**
- `MiniGame<Params, ChallengeState>` interface: `generate(rng, dial)`, `Component`, `judge`, `boosts`, `lanes`, `minCommit`, optional `soloVariantId`.
- Shared primitives: `Timer` (audible), `CardSpread`, `Metronome` (Web Audio — coordinate with E9), `BoostButton` (shows only for committed power-up holders, once-per-game), `OutcomeJudge` (GM confirms; app suggests tier), `DialReadout` (GM-only difficulty display).
- Dial-from-stat wiring: committed crew's lane rating(s) → difficulty.
- Reference game: **Safe-Crack** (exercises generation, deduction state, dial, both lane boosts, GM-confirm judging).

**Acceptance gate:** Safe-Crack runs inside the loop replacing its stub; regenerates fresh each play (seeded); dial visibly shifts with committed stats; both boosts fire once; GM confirms outcome and it feeds the engine.

---

## E5 — The ten mini-games

**Goal:** all ten games + their solo/scaling variants. Largest epic; ships game-by-game.

**Build order (by shared primitive reuse):**
1. Timer + GM-judge: **Categories, Inside Knowledge, Steady Hands**.
2. CardSpread: **The Once-Over, Assembly Line, Defuse the Alarm** (Defuse needs the player-view from E3/its own slice).
3. Metronome/sequence: **Beat 16, Follow the Circuit**.
4. Coordination/deduction state: **Crack the Tumblers** (+ its solo memory variant).

Each game includes: procedural generator, judging (app-assist + GM-confirm per `docs/MINIGAMES.md`), both boosts, and commit-size handling (`minCommit`, dial curve, variant where required — Crack the Tumblers solo variant; Assembly Line 2-player variant; Assembly Line & Defuse excluded from solo).

**Acceptance gate:** all ten playable and replayable; each respects its `minCommit` and dial; the two excluded games never appear in ineligible commit slots (generator test); Crack the Tumblers loads its variant solo.

---

## E6 — The Getaway finale

**Goal:** the Heat-scaled Articulate climax.

**Stories**
- Heat→(target cards, timer) mapping from preset; round-the-circle counter UI; ditch-for-Heat; gear-spend (skip card, buy seconds).
- Climax narration + sound hooks (coordinate with E8/E9).
- Uses the physical Articulate deck — app times, targets, scores; does not store cards.
- Optional player-facing Getaway display via the player-view surface.

**Acceptance gate:** a full run resolves into a tense, Heat-scaled finale producing the engine's win/bust + score; low Heat is generous, high Heat brutal, matching the model bands.

---

## E7 — Scenario content & rolls

**Goal:** all 44 scenarios as validated data with the two-stage roll reveal.

**Stories**
- Scenario schema (Zod); all 44 from `docs/design/heist-content.md` as data: set-up, two choices, hidden effects, lane-weighted rolls, carried effects.
- **Two-stage roll UX:** opaque to commit (flavour only) → on commit + pick-attempter, reveal lane, player rating, base difficulty, and the **d20 DC** (`DC = baseDifficulty − laneRating`, clamped 1–20; success on `roll ≥ DC`; odds shown as `(21−DC)/20`).
- **Dice mode setting** (persisted, default app-roll): **app roll** — after showing the DC, the app rolls a d20 from the seeded RNG; **physical roll** — the app shows the DC then waits for the GM to throw a real d20 and tap in 1–20. Both resolve against the same DC (balance-identical). Engine: the roll-resolution event takes an optional `externalRoll` — present → use it, absent → draw from the seeded RNG (engine stays pure; entered value is recorded in the event log so `{seed,eventLog}` replays exactly; a mistyped roll is undoable). Optional preset flag for nat-1/20 crit/fumble (default off).
- No-repeat draw within a run; resolves every currency (Heat/Loot/Gear/info/delayed).

**Acceptance gate:** content validates against schema in CI; rolls show the correct d20 DC = f(base difficulty, attempter lane rating); **both dice modes resolve a roll correctly (app-roll seeded & reproducible; physical-roll accepts 1–20, validates, and is undoable), and switching mode in settings persists across refresh**; blind-then-transparent flow verified by QA; no scenario repeats within a run.

---

## E8 — Narration bank & teleprompter

**Goal:** the run reads cinematically, never repeating.

**Stories**
- Narration content schema; many variants per beat (briefing, per-game clues, option descriptions, push/run, the three outcome quips, scenario set-ups, Getaway intro/countdown, win/bust stings).
- Non-repeating variant selector (avoid recently-used) seeded off the run RNG.
- Teleprompter presentation: large, paced, one beat at a time, GM-performable.

**Acceptance gate:** a full run surfaces no repeated line; tone stays consistent with the mansion dressing; selector is deterministic under seed.

---

## E9 — Audio engine & soundboard

**Goal:** the GM can score the whole run; metronome games feel tight.

**Stories**
- Web Audio subsystem: preload buffers, play/mix, an ambient bed nudged by Heat (drone low → heartbeat high).
- Context-sensitive soundboard: only buttons relevant to the current moment surface (ambient, heist SFX, stings, danger, finale).
- Shared `Metronome` (precise Web Audio clock) used by Beat 16 / Follow the Circuit.
- Sound manifest from preset.

**Acceptance gate:** soundboard surfaces correct buttons per phase; metronome timing accurate (test against audio clock, not setTimeout); ambient bed responds to Heat.

---

## E10 — Persistence, scoring history & polish

**Goal:** looks the part; full score history. (Refresh-safe run resume already shipped in E3 — this builds on that store.)

**Stories**
- Build on E3's persistence: add the **personal-best leaderboard** ("beat that number") and settings under their own keys; a finished run writes its score to history.
- Cinematic visual pass: design tokens, motion, the face-down Heat cards, the "van" aesthetic.
- Accessibility/glanceability: big hit targets, readable across a room; performance.

**Acceptance gate:** a finished run appears on the leaderboard and persists across refresh/restart; mid-run resume still works (regression check on E3); visual pass approved by the design reviewer; no major a11y/perf regressions.

---

## E11 — Tuning panel & preset tooling

**Goal:** retune the game without leaving the app or editing code.

**Stories**
- Preset system fully realised (depends on `docs/CONTENT-AND-TUNING.md`): named presets, clone, edit, select-at-boot, swap-without-rebuild.
- In-app tuning panel: sliders for Heat constants / Getaway curve / scoring; **embed the Monte Carlo** and show the run-length and win-rate distributions shifting live.
- Validate edited presets before they can be selected.

**Acceptance gate:** edit a preset's Heat constants in-app, see the distribution charts update, save it as a new preset, and play a run on it — all without a rebuild; invalid presets are rejected with a clear message.

---

## E12 — True-offline build (optional)

**Goal:** run with zero dev server.

**Stories**
- Service worker / static `file://`-friendly build so the app double-clicks to play offline.

**Acceptance gate:** built artifact runs fully offline with no `localhost` server; all features intact.

---

## Cross-cutting requirements (apply to every epic)

- **No dead-ends / GM override** (E2 surface) must be honoured by any new state a later epic introduces.
- **Everything tunable is preset data**, never a hardcoded constant.
- **Determinism:** new randomness draws from the run RNG.
- **Player-view isolation:** never leak GM-only state to the player surface.
- **Tests + balance + content validation** stay green (`npm run check:full`).
