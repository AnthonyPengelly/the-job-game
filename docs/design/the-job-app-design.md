# The Job — App Design & Build Plan (v0.1)

Companion to `heist-game-design.md` and `heist-content.md`. This is the software design for the narrator console: a React + Vite + TypeScript single-page app that one person runs on a laptop to drive a whole heist run. The crew never touches it.

---

## 1. What the app actually is

It is a **narrator's console**, not a game *players* look at. One person (the guy in the van) reads from it, runs and referees the mini-games off it, works the soundboard, and tracks Heat/Loot/Gear. The crew only holds cards and looks at the table.

That single framing drives every design decision below:

- **Audience of one, performing for many.** The UI is a teleprompter + control surface, glanceable across a room, operable without looking. Big type, few buttons on screen at any moment, the *next action* always obvious.
- **The laptop is the rulebook.** All randomness, bookkeeping, scaling, scoring, generation, narration and sound live here. So the core has to be a real, testable rules engine — not logic smeared through UI components.
- **Offline by definition.** No backend, no network. A SPA served from `localhost` (or eventually a folder you double-click) is exactly right. Everything ships in the bundle; state lives in memory and `localStorage`.
- **Every run is different.** Procedural generation and a seedable RNG are first-class, not bolted on. That also makes the whole thing testable and lets us re-run the Monte Carlo in the browser.

---

## 2. Architecture at a glance

Five layers, with a hard line between the **engine** (pure TypeScript, no React) and the **console** (React). The engine is the thing your Python simulation already prototyped; the console is the thing you perform from.

```
┌─────────────────────────────────────────────────────────────┐
│  CONSOLE (React + Vite + TS)                                 │
│  Run shell · HUD (Heat/Loot/Gear) · Teleprompter ·          │
│  Soundboard · Mini-game referee screens · Getaway screen    │
├─────────────────────────────────────────────────────────────┤
│  MINI-GAME FRAMEWORK                                          │
│  MiniGame contract · shared primitives (Timer, CardSpread,   │
│  Metronome, BoostButton, OutcomeJudge) · 10 game modules     │
├─────────────────────────────────────────────────────────────┤
│  CONTENT (data-as-modules: TS/JSON)                          │
│  Scenarios · Gear · Narration bank · Question/Category banks │
│  · Sound manifest · Room templates                           │
├─────────────────────────────────────────────────────────────┤
│  ENGINE (pure TS — no DOM, no React)                         │
│  Run state machine · Heat model · Room/Scenario generation · │
│  Gear & crew model · Scaling · Scoring · seedable RNG        │
├─────────────────────────────────────────────────────────────┤
│  PLATFORM                                                     │
│  Audio engine (Web Audio) · Persistence (localStorage) ·     │
│  Settings/tuning · seed control                              │
└─────────────────────────────────────────────────────────────┘
```

### Why this split

- **The engine is framework-agnostic and fully unit-tested.** It is a pure state machine: `(state, event) -> state`. No timers, no audio, no DOM. You can run a thousand simulated runs in a test in milliseconds — which means your existing `heat-model-simulation.py` logic becomes the *same code* that ships, not a separate model that drifts from the app. That is the single most valuable architectural decision here.
- **Mini-games are plugins behind one contract.** Ten games is a lot of surface area. If each one invents its own structure, the app rots. A single `MiniGame` interface (generate → render → judge) keeps them uniform, lets the room loop treat them interchangeably, and makes "add an 11th game" a contained job.
- **Content is data, not code.** Scenarios, gear, narration lines, trivia questions and categories are pure data. That lets you (or a non-coder) expand the banks without touching logic, and lets us validate content with a schema. The 44 scenarios and the narration bank are content, full stop.
- **Audio is its own subsystem** because precise timing (the Beat 16 metronome, Follow the Circuit playback) needs the Web Audio clock, not `setTimeout`. Keeping it isolated stops timing bugs leaking everywhere.

---

## 3. The engine: domain model

A sketch of the core types (TypeScript, illustrative not final):

```ts
type Lane = 'tech' | 'physical' | 'charm' | 'stealth';
type Outcome = 'clean' | 'complication' | 'botched';

interface Player {
  id: string;
  name: string;
  stats: Record<Lane, number>;     // starts mediocre, +1 boosts stack
  powerUps: Partial<Record<Lane, boolean>>;  // up to 4, one per lane
  quirk: QuirkId;                   // starter identity seed
  restingUntilRoom?: number;        // exhaustion rotation
}

interface RunState {
  seed: number;                     // reproducible runs
  phase: RunPhase;                  // briefing | room | offer | getaway | result
  heat: number;                     // 0..20
  loot: number;
  crew: Player[];
  roomIndex: number;
  carried: CarriedEffect[];         // e.g. the ticking briefcase
  history: RoomResult[];
  mansion: MansionDressing;         // villa / estate / penthouse flavour
}

type RunEvent =
  | { t: 'START_RUN'; crew: PlayerSetup[]; seed?: number }
  | { t: 'CHOOSE_OPTION'; optionId: string; committed: PlayerId[] }
  | { t: 'RESOLVE_MINIGAME'; outcome: Outcome }
  | { t: 'CHOOSE_SCENARIO'; choiceId: string; attemptedBy?: PlayerId }
  | { t: 'ASSIGN_GEAR'; gear: GearId; to: PlayerId }
  | { t: 'PUSH_ON' } | { t: 'CALL_GETAWAY' }
  | { t: 'RESOLVE_GETAWAY'; cardsCleared: number; timeLeft: number };

function reduce(state: RunState, event: RunEvent): RunState;  // pure
```

Everything the Python sim does — heat steps, the escalation ramp from ~room 5, the escape signal at Heat 11, the forced Getaway at 20, the Heat-scaled Getaway odds, scoring with the low-Heat style bonus — lives here as pure functions over `RunState`. The sim and the app become one body of code.

### The run as a state machine

I'd model the run flow explicitly (a hand-rolled reducer + a small state-machine helper, or XState if we want visualisable charts — leaning hand-rolled to start, it's not complex enough to warrant the dependency):

```
Briefing → Room ─┬─ Obstacle → CommitCrew → MiniGame → Resolve ─┐
                 └─ Scenario → Choose → Reveal ─────────────────┤
                                                                 ▼
                                                    Offer (push or run?)
                                                       │           │
                                                  push on      call getaway
                                                       │           ▼
                                                       │        Getaway → Result → (again)
                                                       └──► (Heat≥20 forces Getaway)
```

### Determinism & seeding

One seedable PRNG (e.g. a small `mulberry32`) threaded through the engine. Same seed + same inputs = same run. This buys: reproducible playtests ("run seed 1312 again"), trivial unit tests, and a "replay last run" feature. The room generator, scenario draw, gear draft, and every mini-game's parameter generator all draw from this stream.

---

## 4. The mini-game framework

The ten games span very different mechanics (silent coordination, timing, trivia, dexterity, deduction…), but they share a lifecycle. One contract:

```ts
interface MiniGame<Params, ChallengeState> {
  id: GameId;
  lanes: Lane[];                                   // 1 lane, or 2 for combos
  generate(rng: RNG, dial: Difficulty): Params;    // procedural, fresh each run
  // dial is derived from the committed crew's lane rating(s)
  Component: React.FC<MiniGameProps<Params, ChallengeState>>;
  judge(state: ChallengeState, params: Params): Outcome;  // clean/comp/botch
  boosts: BoostHook[];                             // shouted plays for power-up holders
}
```

The room loop hands a game its dial (from the committed players' stats), it generates fresh parameters, the narrator runs it, and it reports an `Outcome` back into the engine. The narrator is always the referee — most games end with the narrator confirming the outcome, some self-judge (timers, taps), which keeps trust where it belongs (with the human in the van).

**Shared primitives** (build once, reuse across all ten):

- `Timer` / countdown with audible ticking, pause, and the dial setting the duration.
- `CardSpread` — render face-up/face-down cards (The Once-Over's room, Defuse's wires, Follow the Circuit's grid).
- `Metronome` — Web Audio precise beats (Beat 16, Follow the Circuit playback).
- `BoostButton` — context-aware "shout to use" control, shown only when a committed player holds the lane power-up, fires once per game.
- `OutcomeJudge` — the clean/complication/botched control the narrator taps, with the comedic middle tier always one button away.
- `DialReadout` — shows the narrator the current difficulty (so they know how hard it's set) without showing the crew.

**Grouping the ten by shared primitive** (this is the build order within the games epic, sequenced by reuse):

1. *Timer + manual judge:* Categories, Steady Hands, Inside Knowledge — simplest, prove the loop.
2. *CardSpread:* The Once-Over, Defuse the Alarm, Assembly Line.
3. *Metronome/sequence:* Beat 16, Follow the Circuit.
4. *Deduction/coordination state:* Safe-Crack, Crack the Tumblers.

Each game also needs its **solo / 2–3-player variant** (the scaling note in the design doc) — handled by the `dial` and a `headcount` param, not separate code paths where avoidable.

---

## 5. The console (UI)

Screens, all driven by the engine's `phase`:

- **Setup** — crew size (2–7), names, starter quirks, optional seed. The app picks the scaling profile invisibly.
- **Briefing** — mansion dressing + opening narration to read aloud. One "begin" action.
- **Room (obstacle)** — the van's clue, then the 2–3 options (game · reward · Heat cost) as big cards; narrator commits crew; launches the mini-game screen.
- **Room (scenario)** — set-up to read, two choices; on commit, the hidden effect reveal (and, for rolls, pick-who-attempts then a weighted resolve the crew never sees the maths of).
- **Mini-game referee screen** — the game's own component, plus the persistent HUD and the contextual soundboard.
- **The Offer** — push on or call the Getaway, with the Heat read ("getting hot — we can roll" surfaced at the escape signal).
- **Getaway** — Heat-scaled target + timer, round-the-circle card counter, ditch button, gear-spend.
- **Result** — win with a number / busted with a smaller one, the score breakdown, and "go again" (carrying score history for the "I can do better" hook).

**Persistent HUD:** Heat as the face-down-card track (0–20), Loot, and the crew's gear/exhaustion state — always visible, glanceable.

**Teleprompter principle:** narration is large, paced, one beat at a time; the narrator performs lines, never reads paragraphs. Variant selection (next section) keeps it fresh.

**Design tokens / vibe:** dark, cinematic, "van" aesthetic. The design system is complete and lives in `design-system/` — tokens, type, UI kits, and component patterns are all specified; `docs/DESIGN-SYSTEM.md` has the implementation checklist. Token setup happens in E0 (not a placeholder); the full visual pass is E10. Function ships first; styling lands in E10.

---

## 6. Cross-cutting systems

**Narration bank.** Many variants per beat (briefing, per-game clues, option descriptions, push/run prompts, the three outcome quips, scenario set-ups, Getaway intro/countdown, win/bust stings). A small selector that avoids recently-used variants so a coherent mood builds without repeats across a run. Pure content + a tiny picker.

**Soundboard / audio engine.** Web Audio, preloaded buffers, context-sensitive: only the buttons relevant to the current moment surface (ambient/tension, heist SFX, stings, danger, finale). The Heat level can nudge the ambient bed (heartbeat high, drone low). Metronome shares this engine.

**Scaling 2–7.** Lives entirely in the engine: exhaustion strength, crew-needed per option, mini-game headcount variants. The players never see the logic; the UI never branches on it beyond what the engine reports.

**Persistence.** `localStorage` for: resume an in-progress run, score history / personal-best leaderboard, settings, last seed. No accounts, no server.

**Tuning panel (dev/optional).** Expose the heat constants (HMAX, run-at fraction, ramp, costs, Getaway curve) behind a hidden settings screen, and embed the Monte Carlo so you can re-balance in-browser and *see* the run-length and win-rate distributions shift. This keeps your simulation work alive inside the product.

---

## 7. Key decisions & tradeoffs

- **Pure engine vs. logic-in-components.** Chosen: pure engine. Costs a little upfront ceremony; buys testability, a single source of truth with your sim, and sane scaling/balance work. Non-negotiable for something this rules-heavy.
- **Hand-rolled reducer vs. XState.** Starting hand-rolled — the flow is linear-ish and the dependency/learning cost of XState isn't justified yet. Revisit if the state graph sprouts.
- **State management:** engine state in one store (Zustand is a clean fit — minimal, no boilerplate, lives outside React nicely and mirrors the pure engine). React Context only for theme/audio handles.
- **Mini-game plugin contract vs. bespoke screens.** Contract. Ten bespoke screens would diverge and rot; the contract is the thing that makes "ten games" tractable.
- **Web Audio vs. `<audio>` tags.** Web Audio — needed for metronome precision and for mixing the ambient bed under SFX. Plain tags can't hit the timing.
- **Content as data vs. hardcoded.** Data, with a schema and a validation test so a malformed scenario fails loudly in CI, not silently at the table in France.
- **No PWA/offline-installer initially.** A `localhost` SPA meets the brief. We can add a service worker / `file://` build later if you want to run it with no dev server at all — it's a small, deferrable epic.

---

## 8. Epic breakdown

Sequenced so the thing is *playable end-to-end as early as possible*, then deepened. Each epic is a coherent slice with a clear "done." Dependencies noted.

### Epic 0 — Foundations & scaffold
Vite + React + TS project, linting/formatting, Vitest, folder structure (engine / content / games / console / platform), seedable RNG, design tokens (from `design-system/colors_and_type.css` — self-hosted fonts, no CDN), CI that runs tests. **Done:** empty app shell renders, one passing engine test, RNG reproducible.

### Epic 1 — Core rules engine *(depends: 0)*
Port the Python model to TS: `RunState`, `reduce`, heat steps, escalation ramp, escape signal, forced Getaway, Getaway odds, scoring. A headless test harness that runs N simulated runs and reports the same distributions your sim does (median ~4–5 obstacles, runs rarely past 10, win-rate bands by skill). **Done:** TS sim reproduces the Python numbers within tolerance. *This is the backbone — everything leans on it.*

### Epic 2 — Crew, gear & scaling *(depends: 1)*
Player model, stats, the two reward layers (stat boosts that stack, four lane power-ups that don't), gear assignment, starter quirks, exhaustion rotation, and the 2–7 scaling profiles. **Done:** can set up a crew of any size and the engine deals an appropriately-scaled job.

### Epic 3 — Room loop & console shell (mini-games stubbed) *(depends: 1, 2)*
The whole playable spine: Setup → Briefing → Obstacle (options + commit) → Scenario (choose + reveal) → Offer (push/run) → Getaway → Result → again. Mini-games are **stubbed** as a "narrator picks clean/comp/botch" button. HUD live. **Done:** you can play a complete run start to finish, just without real mini-games. *This is the first true playtest build — get here fast.*

### Epic 4 — Mini-game framework + reference game *(depends: 3)*
The `MiniGame` contract, shared primitives (Timer, CardSpread, BoostButton, OutcomeJudge, DialReadout), dial-from-stat wiring, boost hook plumbing, and **one fully-built reference game** (suggest Safe-Crack — exercises generation, deduction state, dial, and both lane boosts). **Done:** one real game runs inside the loop replacing its stub.

### Epic 5 — The ten mini-games *(depends: 4)*
Implement the remaining nine, in the reuse order from §4 (timer-based → card-spread → metronome → deduction). Each includes its procedural generator, judging, boosts, and solo/2–3 variant. Biggest epic; ships incrementally — each game is independently shippable into the loop. **Done:** all ten playable, each replayable (fresh params), each with its boost.

### Epic 6 — The Getaway finale *(depends: 3)*
Heat→(target cards, timer) mapping, round-the-circle counter UI, ditch-for-Heat, gear-spend (skip/buy seconds), the climax narration/sound. Uses your physical Articulate deck — the app times and scores, doesn't store the cards. **Done:** a tense, Heat-scaled finale that resolves into the engine's win/bust.

### Epic 7 — Scenario content & rolls *(depends: 3)*
Wire all 44 scenarios as validated data: set-ups, two choices, hidden effects, and the **lane-weighted rolls** (pick-who, concealed odds). Reveal flow. Carried effects (ticking briefcase, 3-room unlock). **Done:** scenarios draw without repeats and resolve every currency (Heat/Loot/Gear/info/delayed).

### Epic 8 — Narration bank & teleprompter *(depends: 3)*
Author the variant lines for every beat, the non-repeating selector, and the teleprompter presentation. **Done:** a full run reads cinematically with no repeated lines.

### Epic 9 — Audio engine & soundboard *(depends: 4 for metronome)*
Web Audio subsystem, preload, context-sensitive soundboard, Heat-driven ambient bed, shared metronome. **Done:** the narrator can score the whole run; metronome games feel tight.

### Epic 10 — Persistence, scoring history & polish *(depends: 3)*
Resume, personal-best leaderboard ("beat that number"), settings, full visual pass against the design system (`design-system/` — UI kits, token application, specimen verification; see `docs/DESIGN-SYSTEM.md`), accessibility (glanceability, big hit targets), perf. **Done:** survives a closed laptop lid; every screen matches the design-system preview specimens.

### Epic 11 — Tuning panel & content tooling *(optional; depends: 1)*
In-browser Monte Carlo + constant sliders to re-balance and watch distributions; optional content-authoring/validation screen. **Done:** you can retune Heat without leaving the app.

### Epic 12 — True-offline build *(optional; depends: most)*
Service worker / static `file://` build so it runs with zero dev server. **Done:** double-click to play, no `localhost`.

### Dependency shape

```
0 → 1 → 2 ┐
          ├→ 3 → 4 → 5
          │    ├→ 6
          │    ├→ 7
          │    ├→ 8
          │    └→ 9
          └────────→ 10
1 → 11   (anytime after engine)
… → 12   (last)
```

---

## 9. Suggested MVP cut line (first playable in France)

A vertical slice you could actually run at a table:

**Epics 0–3, plus a slim 4–9:** core engine + crew/scaling + full room-loop shell, **3 mini-games** (one solo, one combo, one timing — e.g. Categories, Safe-Crack, Beat 16), the Getaway, ~15 of the 44 scenarios, a first pass of narration for every beat, and a basic soundboard. Stub the other seven games as "narrator-judged" so the loop never blocks.

That gets a real, fun, end-to-end heist on the table fast, with the architecture in place to slot the remaining games and content in without rework. Everything after is additive.

---

## 10. v0.2 — Decisions from review

This section records the resolved decisions from the first design review. Where they touch an epic, the epic in §8 is updated accordingly.

### 10.1 GM is in charge; the app assists and never blocks

The GM makes the calls. The app's job is to *remove bookkeeping and detail-anxiety*, not to police the GM. Two concrete consequences:

- **Crew & gear tracking with a direct-manipulation UI.** The app tracks every player's four lane stats, their up-to-four power-ups, exhaustion/rotation, and quirks. When a reward appears ("a Tech boost and a power-up dropped"), the GM **drags the loot card onto the player who takes it** — fast, physical, matches the table. The HUD always shows who holds what.
- **Overrides everywhere — no "computer says no."** Every tracked value is GM-editable at any time: nudge Heat up/down, hand or remove a stat/power-up, mark a player rested or un-rested, force a mini-game outcome, re-roll or skip a room, jump phases. The engine is the *default* path; the GM can always overrule it. Design rule: **no dead-ends.** Any state the engine can reach, the GM can edit out of. This is an explicit Epic 2 + Epic 3 requirement, with a persistent "GM override" affordance and an "undo last" on every mutation.

### 10.2 The app is GM-facing, with deliberate player-facing exceptions

Primary surface is the narrator console (one laptop, GM only). A small number of moments need a **second, player-facing view** — handled as a separate route/screen the GM can cast, hand over, or open on a second device:

- **Defuse the Alarm** — the asymmetric-info game *requires* one player to privately see the rulebook. This is the main player-facing screen.
- **Possible others** (kept behind the same "player view" mechanism): a shared countdown/Heat display for the Getaway, or a "show the crew this card spread" moment. Built as an opt-in cast surface, not the default.

Architecturally: a `player-view` route that mirrors a slice of engine state over a local channel (`BroadcastChannel`/postMessage for same-machine, or a tiny localhost socket if a second device is used). Scoped as its own concern so the GM console never leaks information to it by accident.

### 10.3 Roll transparency: opaque to commit, then fully transparent

Confirmed flow for scenario **Rolls**:

1. **Before the choice:** only the flavour hint shows ("tiptoe past" / "sweet-talk them"). The crew picks blind — no lane, no odds, no DC.
2. **After they commit and pick who attempts:** the app **reveals the lane, the attempting player's rating in it, the attempt's base difficulty, and the resulting DC/odds** — computed as `DC = baseDifficulty − playerLaneRating` (or equivalent), so a specialist visibly lowers the bar. Then the roll happens against those shown odds.

So it's *blind decision, transparent resolution* — the tension is in committing without knowing, the fairness is in seeing exactly why the roll is what it is. This is an Epic 7 requirement and needs a clear two-stage reveal in the UI.

### 10.4 Mini-game judging: app assists, GM confirms

The crew plays in the real world; results flow back to the app. Per game, the app does as much *helpful, non-interfering* work as it can (timing, generating, tracking taps where it can sense them, offering the clean/complication/botched call with a suggested tier) — but the **GM confirms the outcome**. The app never overrides the room based on its own guess. Per-game division of "app senses vs GM calls" is specified in `docs/MINIGAMES.md` and settled during Epic 5.

### 10.5 Solo / 2–3 committed-player variants (resolved)

Each game is tagged `minCommit` (hard floor) and, where relevant, a `soloVariantId`. The room generator filters on `minCommit` **before** applying the difficulty dial — difficulty is never used to paper over a missing player.

| Game | Solo (1 committed) | 2–3 committed | Min viable |
|------|--------------------|---------------|-----------|
| Beat 16, Categories, The Once-Over, Follow the Circuit, Inside Knowledge, Safe-Crack, Steady Hands | Dial only | Dial only | 1 |
| Crack the Tumblers | **Separate solo variant** (memory test — silent-sync has no meaning solo) | Dial | 1 (variant) / 2 (true game) |
| Assembly Line | **Excluded** (no one to trade with) | Variant @2 (negotiated-swap), Dial @3 | 2 / 3 |
| Defuse the Alarm | **Excluded** (asymmetric info collapses with one player) | Dial | 2 |

Generator rule: choose on `minCommit` first (eligibility), then resolve variant-vs-parent by slot size, then apply the dial. Keep the solo-eligible pool ≥8 games so single-commit obstacles never starve; if a layout would force an excluded game onto a solo slot, **re-roll the obstacle** rather than down-dial an impossible mechanic. Full per-game reasoning lives in `docs/MINIGAMES.md`.

### 10.6 Content, rules, tuning & scaling are fully separable

A hard requirement, not a nicety. Everything that can be tuned lives **outside the engine logic** as data, loaded as a named **preset (ruleset)**:

- **Content packs:** scenarios, gear, narration banks, trivia/category banks, sound manifests, room templates.
- **Tuning packs:** the Heat constants (HMAX, run-at fraction, escalation ramp, per-option costs, outcome Heat, scenario swings), Getaway curve, scoring weights.
- **Scaling packs:** the 2–7 profiles (exhaustion strength, crew-needed-per-option, per-game commit/dial curves).

The app boots with a selected preset and you can **swap presets without a rebuild** (e.g. *"Default", "Spicy (hotter Heat)", "Gentle", "Playtest-A"*). This makes playtesting a matter of cloning a preset, tweaking numbers, and trying it — and lets the balance harness (below) run any preset headlessly. Specified in `docs/CONTENT-AND-TUNING.md`; this elevates the old Epic 11 from "optional tuning panel" to a **first-class system** that the engine, the tuning panel, and the agent build all depend on.

### 10.7 Game-design rigour & agent-led testing are built in

Two layers, both mandatory in the build:

- **Balance harness (headless).** The TS port of your Monte Carlo runs in CI against any preset and **asserts** the design targets (median ~4–5 obstacles, runs rarely past 10, win-rate bands by skill, Loot roughly doubling poor→good crew). A preset that breaks these fails the build. This keeps your simulation work as a living guardrail, not a one-off.
- **Agent-led QA.** Playwright MCP drives the SPA through full runs (seeded, deterministic), checks the loop never dead-ends, that overrides work, that the player-view leaks nothing, and screenshots key states for a human pass. Specified in `docs/GAME-DESIGN-RIGOUR.md` and `docs/TESTING.md`.

### 10.8 Build the whole thing (no MVP gating)

Per your steer: the build is sequenced for **coherence and dependency-safety**, not for an early-MVP cut. The §9 "MVP cut line" stands only as an optional fallback if you ever want an early table-test; the default plan in §8 builds all epics to completion before playtest. The orchestration for that big-bang build is specified separately in `docs/ORCHESTRATION.md`.

---

## 11. Where this is going next

The architecture above is the *what*. The companion build kit (`the-job/` repo skeleton) is the *how it gets built*: a `CLAUDE.md`-driven set of docs, an epic backlog, and an autonomous multi-agent orchestration (planner → builder → reviewers → QA fix-loop) designed to run Claude Code in a Docker container and produce the whole app in one big-bang build, cheaply and coherently. See `docs/ORCHESTRATION.md` and `docs/EPICS.md` in that kit.
```