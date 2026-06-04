# ARCHITECTURE.md — The Job

Layers, module boundaries, dependency rules, and the engine. This is the
operational restatement of `docs/design/the-job-app-design.md` §§2–7. Where
this doc and the design doc disagree, **the design doc wins** — fix this one.

The single most important fact: there is a hard line between the **engine**
(pure TypeScript, no React, no DOM) and everything that performs from it. The
engine is `(state, event) => state` and is the *same code* as the balance
simulation. Everything below protects that line.

---

## 1. The five layers

The app is five layers with a strict one-way dependency flow. A layer may
import from layers *below* it; never from a layer *above*. Two surfaces sit at
the top — `console` (GM-facing) and `player-view` (player-facing) — and neither
imports the other.

```
                 ┌───────────────────────┐   ┌───────────────────────┐
                 │  CONSOLE (React, GM)   │   │  PLAYER-VIEW (React)   │
                 │  run shell · HUD ·     │   │  isolated player       │
                 │  teleprompter ·        │   │  surface (Defuse       │
                 │  soundboard · referee  │   │  rulebook, Getaway     │
                 │  screens · overrides   │   │  display)              │
                 └───────────┬───────────┘   └───────────┬───────────┘
                             │                           │
                             │        read-only slice    │
                             │        over a channel ─────┘
                             ▼
                 ┌───────────────────────────────────────┐
                 │  MINIGAMES (React + the MiniGame        │
                 │  contract + shared primitives)          │
                 └───────────────────┬─────────────────────┘
                                     ▼
                 ┌───────────────────────────────────────┐
                 │  CONTENT (data-as-modules: TS/JSON,     │
                 │  Zod-validated presets & banks)         │
                 └───────────────────┬─────────────────────┘
                                     ▼
                 ┌───────────────────────────────────────┐
                 │  ENGINE (pure TS — no React, no DOM,    │
                 │  no timers, no audio, no Math.random)   │
                 └───────────────────────────────────────┘

      PLATFORM (audio · persistence · preset loader) is a side service:
      console / player-view call into it; the engine never does.
```

One-way flow: **engine → content → minigames → console / player-view**, with
**platform** as a leaf service the two React surfaces drive (never the engine).
Never import upward. The engine imports nothing from React, the DOM, or
platform.

| Layer | Lives in | What it is | May import | May NOT import |
|-------|----------|-----------|-----------|----------------|
| **engine** | `src/engine` | Pure reducer, Heat model, generation, scaling, scoring, seeded RNG | `@/engine` internals only | React, DOM, timers, audio, `Math.random`, content, minigames, console, player-view, platform |
| **content** | `src/content` | Scenarios, gear, narration, banks, sound manifest, room templates, presets — all Zod-validated data | `@/engine` (types only) | React, DOM, minigames, console, player-view, platform |
| **minigames** | `src/minigames` | The `MiniGame` contract, shared primitives, the ten game modules | `@/engine`, `@/content`, `@/platform` (audio handle) | console, player-view, *another game's internals* |
| **console** | `src/console` | GM-facing React app: run shell, HUD, teleprompter, soundboard, referee screens, override surface | everything below | player-view |
| **player-view** | `src/player-view` | Isolated player-facing React surface | `@/engine` (types), `@/platform` (channel), `@/content` (player-safe slices) | console, GM-only state |
| **platform** | `src/platform` | Audio engine, persistence, preset loader, the player-view channel | `@/engine` (types), `@/content` (schemas) | console, player-view, minigames |

---

## 2. Folder structure under `src/`

```
src/
├── engine/                  ← pure TS. No React. No DOM. No Math.random.
│   ├── types.ts             ← Lane, Outcome, Player, RunState, RunEvent, RunPhase…
│   ├── reduce.ts            ← reduce(state, event): RunState — the heart
│   ├── rng.ts               ← mulberry32 seeded RNG (the ONLY randomness source)
│   ├── heat.ts              ← drip, surcharge, outcome Heat, ramp, escape signal, HMAX
│   ├── generation.ts        ← room/obstacle/scenario stream (seeded, no-repeat)
│   ├── crew.ts              ← stats, power-ups, gear, exhaustion/rotation
│   ├── scaling.ts           ← 2–7 profiles applied from the active preset
│   ├── scoring.ts           ← Getaway odds, win/bust, low-Heat style bonus
│   ├── overrides.ts         ← GM-override events + UNDO_LAST (no dead-ends)
│   └── *.test.ts            ← co-located unit tests (every reducer branch)
│
├── content/                 ← data-as-modules, validated at the boundary
│   ├── schema/              ← Zod schemas for every content + preset shape
│   ├── presets/             ← named presets: default, spicy, gentle, playtest-a
│   ├── scenarios/           ← the 44 scenarios as data
│   ├── gear/                ← gear definitions
│   ├── narration/           ← per-beat variant banks
│   ├── banks/               ← trivia / category / question banks
│   ├── sound/               ← sound manifest (paths + cues, not buffers)
│   └── *.test.ts            ← schema validation tests
│
├── minigames/
│   ├── contract.ts          ← MiniGame<Params, ChallengeState>, MiniGameProps, BoostHook
│   ├── registry.ts          ← GameId → MiniGame; the room loop resolves through this
│   ├── primitives/          ← Timer, CardSpread, Metronome, BoostButton,
│   │                          OutcomeJudge, DialReadout (build once, reuse ten times)
│   └── games/
│       ├── safe-crack/      ← each game is a folder: index.ts, component.tsx,
│       │   ├── index.ts     ←   generate.ts, judge.ts, *.test.ts
│       │   ├── component.tsx
│       │   ├── generate.ts
│       │   ├── judge.ts
│       │   └── safe-crack.test.ts
│       ├── categories/
│       ├── crack-the-tumblers/   (+ its solo variant)
│       └── …                ← ten total
│
├── console/                 ← GM-facing React app (the narrator's console)
│   ├── app.tsx              ← run shell; renders by engine phase
│   ├── store/               ← Zustand store wrapping the pure engine (see §5)
│   ├── screens/             ← setup, briefing, obstacle, scenario, offer, getaway, result
│   ├── hud/                 ← Heat track (0–20 face-down cards), Loot, crew/gear/exhaustion
│   ├── overrides/           ← always-available GM edit surface + "undo last"
│   ├── teleprompter/        ← large, paced, one-beat-at-a-time narration
│   ├── soundboard/          ← context-sensitive buttons (drives platform audio)
│   └── theme/               ← design tokens, the dark "van" aesthetic (polish, late)
│
├── player-view/             ← isolated player-facing surface (§6)
│   ├── app.tsx              ← its own route/entry; never imports console
│   ├── channel.ts           ← receives the read-only slice over the platform channel
│   └── screens/             ← Defuse rulebook, optional Getaway display
│
└── platform/                ← side services (no game logic)
    ├── audio/               ← Web Audio engine: buffers, mixing, the Heat-nudged bed
    ├── persistence/         ← localStorage: resume, leaderboard, settings, last seed
    ├── presets/             ← preset loader: load → Zod-parse → hand validated data up
    └── channel/             ← BroadcastChannel/postMessage bus for player-view
```

The skeleton `src/{engine,content,minigames,console,player-view,platform}` is
created in E0. Empty later-epic folders may exist as placeholders, but never
add an upward import to a placeholder.

---

## 3. The one-way dependency rule (and how it's enforced)

The dependency direction is **not** a guideline — it is mechanically enforced by
an ESLint import-direction rule wired in E0 (`no-restricted-imports` /
`eslint-plugin-import` zones). The rule encodes the table in §1:

- `src/engine/**` may import only from `src/engine/**`. Importing React, the
  DOM, `@/content`, `@/minigames`, `@/console`, `@/player-view`, `@/platform`,
  or `Math.random` is a lint error.
- `src/content/**` may import `@/engine` (types) only.
- `src/minigames/**` may import `@/engine`, `@/content`, `@/platform`; not the
  surfaces, and not another game's internals (go through `registry.ts`).
- `src/console/**` may import anything below it but **not** `@/player-view`.
- `src/player-view/**` may import `@/engine` types, `@/platform` channel, and
  player-safe `@/content`; never `@/console` and never a GM-only state shape.
- `src/platform/**` may import `@/engine` types and `@/content` schemas; never a
  surface and never `@/minigames`.

E0's acceptance gate **proves** the rule bites: a temporary commit that imports
React into the engine must fail `npm run lint`, then is deleted. If the rule
ever stops failing on an engine→React import, treat it as a broken sensor and
fix it before anything else. `Math.random` in the engine is likewise banned by
lint — all randomness flows through `src/engine/rng.ts` (§7).

---

## 4. The engine's shape

The engine is a pure state machine: `reduce(state, event) => state`. No timers,
no audio, no DOM, no `Math.random`. You can run a thousand simulated runs in a
millisecond test — which is exactly why the balance simulation and the shipped
app are *one body of code*, not a model that drifts.

The core types (illustrative, from the design doc §3 — the canonical definitions
live in `src/engine/types.ts`):

```ts
type Lane = 'tech' | 'physical' | 'charm' | 'stealth';
type Outcome = 'clean' | 'complication' | 'botched';

interface Player {
  id: string;
  name: string;
  stats: Record<Lane, number>;              // starts mediocre, +1 boosts stack
  powerUps: Partial<Record<Lane, boolean>>; // up to 4, one per lane, no stack
  quirk: QuirkId;                            // starter identity seed
  restingUntilRoom?: number;                 // exhaustion rotation
}

interface RunState {
  seed: number;                  // reproducible runs
  phase: RunPhase;               // briefing | room | offer | getaway | result
  heat: number;                  // 0..20
  loot: number;
  crew: Player[];
  roomIndex: number;
  carried: CarriedEffect[];      // e.g. the ticking briefcase
  history: RoomResult[];
  mansion: MansionDressing;      // villa / estate / penthouse flavour
}

type RunEvent =
  | { t: 'START_RUN'; crew: PlayerSetup[]; seed?: number }
  | { t: 'CHOOSE_OPTION'; optionId: string; committed: PlayerId[] }
  | { t: 'RESOLVE_MINIGAME'; outcome: Outcome }
  | { t: 'CHOOSE_SCENARIO'; choiceId: string; attemptedBy?: PlayerId }
  | { t: 'ASSIGN_GEAR'; gear: GearId; to: PlayerId }
  | { t: 'PUSH_ON' } | { t: 'CALL_GETAWAY' }
  | { t: 'RESOLVE_GETAWAY'; cardsCleared: number; timeLeft: number };
// …plus the GM-override events (set/adjust Heat & Loot, grant/remove gear,
//    set/clear exhaustion, force outcome, re-roll/skip room, jump phase) and
//    { t: 'UNDO_LAST' }. See §8 and src/engine/overrides.ts.

function reduce(state: RunState, event: RunEvent): RunState; // pure
```

`RunEvent` is a **discriminated union** keyed on `t`. `reduce` switches on `t`
exhaustively (every branch returns a fresh `RunState`; the `default` is a
`never`-assert). Every branch is unit-tested.

**Purity constraints — non-negotiable:**

- No React, no DOM, no `window`/`document`, no timers, no audio.
- No `Math.random`, no `Date.now()`, no `crypto` — nothing wall-clock or
  ambient. Time and randomness enter only as explicit inputs.
- No mutation of the input `state`; `reduce` returns a new object.
- No I/O: no `fetch`, no `localStorage`, no file reads. Loaded data arrives
  already-parsed from the boundary (§7, §8).
- No tunable constants in code. HMAX, the run-at fraction, ramp, costs, the
  Getaway curve, scoring weights — all read from the active preset (§8).

### The run as a state machine

`phase` drives the flow; the reducer + a small hand-rolled state-machine helper
implement it (XState was considered and declined — revisit only if the graph
sprouts):

```
Briefing → Room ─┬─ Obstacle → CommitCrew → MiniGame → Resolve ─┐
                 └─ Scenario → Choose → Reveal ─────────────────┤
                                                                 ▼
                                                    Offer (push or run?)
                                                       │           │
                                                  push on      call getaway
                                                       │           ▼
                                                       │   Getaway → Result → (again)
                                                       └──► (Heat ≥ 20 forces Getaway)
```

### The seeded RNG

One seedable PRNG (`mulberry32`) in `src/engine/rng.ts` is threaded through the
engine. Same seed + same inputs = same run. Room generation, scenario draw, gear
draft, and **every** mini-game's parameter generator draw from this one stream.
The RNG instance is passed in explicitly (it is engine state-adjacent, never a
module-level singleton). This buys reproducible playtests ("run seed 1312
again"), trivial tests, replay, and the headless Monte Carlo. `rng.ts` ships
with a reproducibility test (E0 gate).

---

## 5. The state-store boundary

The engine is pure and lives outside React. The **store** is the only bridge.

- The store is **Zustand**, in `src/console/store/`. It holds the current
  `RunState` and dispatches `RunEvent`s through `reduce`. It *mirrors* the engine
  — it does not reimplement any rule.
- **React never mutates engine state directly.** Components dispatch events; the
  store calls `reduce(state, event)` and swaps in the result. There is no
  `setState` that pokes at `heat` or `loot` by hand — the only way Heat changes
  is an event through the reducer (including the GM-override events).
- This keeps a single source of truth and lets the same `reduce` run headless in
  the sim. If a component needs to "change state", the answer is always: define
  (or reuse) a `RunEvent`, not a store mutator.
- React Context is used **only** for theme and audio handles — never for game
  state. Game state is the store; the store is the engine.

```
React component ── dispatch(event) ──▶ Zustand store ── reduce(state, event) ──▶ new RunState
       ▲                                                                              │
       └───────────────────────── re-render from new state ◀──────────────────────────┘
```

`UNDO_LAST` is implemented in the engine/store as a history of prior states (or
prior events), so every mutation — including every GM override — is reversible
(§8). The store keeps that history; the reducer stays pure.

---

## 6. Player-view isolation

The console is GM-facing. The `player-view` surface is a *deliberate, isolated*
exception — Defuse the Alarm's private rulebook, and the optional Getaway
display. It must **never** leak GM-only state (Heat internals, odds, hidden
scenario effects, the dial, upcoming rooms).

The mechanism:

- `player-view` is its **own route/entry** the GM can cast, hand over, or open
  on a second device. It does not import `@/console`.
- State reaches it as a **read-only slice** over a local channel —
  `BroadcastChannel`/`postMessage` for same-machine, a tiny localhost socket if a
  second device is used. The channel lives in `src/platform/channel/`.
- The slice is a **purpose-built, player-safe projection** — a separate type
  (`PlayerViewSlice`) containing only what that moment needs (e.g. the Defuse
  wires, or a countdown + a coarse Heat indicator for the Getaway). The full
  `RunState` is never sent.
- The projection is built console-side and Zod-validated at the boundary before
  it crosses the channel; `player-view` parses it again on receipt. If a future
  field would expose GM-only data, it simply isn't in the slice type — isolation
  is enforced by *what the type allows*, not by remembering not to send it.
- Data flows **one way**: console → channel → player-view. The player surface
  never writes back game state.

This is a cross-cutting invariant: any epic that adds state must not widen the
player slice to include GM-only data. QA asserts the player-view leaks nothing.

---

## 7. The platform layer

`src/platform/` holds side services with no game logic. The engine never calls
into it; the React surfaces do.

- **Audio engine** (`audio/`). Web Audio — preloaded buffers, play/mix, and an
  ambient bed nudged by Heat (drone low → heartbeat high). Web Audio, not
  `<audio>` tags, because the metronome (Beat 16, Follow the Circuit) needs the
  precise Web Audio clock, not `setTimeout`. The shared `Metronome` primitive
  drives this engine. Keeping audio isolated stops timing bugs leaking.
- **Persistence** (`persistence/`). `localStorage` only — no accounts, no
  server. Must survive a **hard refresh / tab close / crash mid-room**, not just
  a clean shutdown: **write-through after every engine event** (not on a timer or
  on close), and **hydrate-on-boot** so the store rehydrates before first render
  and Setup offers *Resume* vs *New job*. Saves are **schema-versioned and
  Zod-parsed on load** (§8); a save that no longer matches the engine/preset
  version fails loudly and offers a clean restart rather than corrupting a run.
  Because the engine is a deterministic seeded reducer, the in-progress save is
  `{ seed, eventLog }` and full state is reconstructed by replay (compact,
  debuggable). Leaderboard / settings / last-seed live under separate keys so
  clearing a run never wipes the leaderboard. This write-through wrapper is part
  of the **store boundary** (E3), so every playable build survives a refresh.
- **Preset loader** (`presets/`). Loads the selected preset, **Zod-parses** it,
  and hands validated data up. Presets are swappable without a rebuild
  (`default`, `spicy`, `gentle`, `playtest-a`). The loader is also what the
  balance harness uses to run any preset headlessly. Schemas and content live in
  `src/content/`; the loader is the runtime that reads them.
- **Channel** (`channel/`). The player-view bus (§6).

---

## 8. Cross-cutting rules

These hold in every layer and every epic. They are invariants, not features.

- **Determinism.** All randomness flows through the one seeded RNG
  (`src/engine/rng.ts`). Same seed + same inputs ⇒ same run. Any new randomness a
  later epic introduces draws from the run RNG — never `Math.random`, never a
  fresh PRNG. This is what makes the game testable and the Monte Carlo
  meaningful.

- **Parse at the boundary.** Every piece of external or loaded data — presets,
  content packs, persisted state, the player-view slice — is validated with a Zod
  schema **before** use. Schemas are co-located in `src/content/schema/`.
  Malformed data fails loudly at load, never silently at the table in France.
  Inside a layer, once parsed, types are trusted — no defensive re-checking.

- **GM-override / no dead-ends.** The engine is the *default* path; the GM can
  always overrule it. Every tracked value (Heat, Loot, stats, power-ups,
  exhaustion, outcomes, gear, phase) is editable at any time via a typed
  override `RunEvent`, and every mutation is undoable (`UNDO_LAST`). **No state
  the engine can reach is a dead-end** — the GM can always edit out of it.
  Overrides go through `reduce` like any other event, so they remain pure,
  testable, and reversible. Any new state a later epic introduces must honour
  this — there is no "computer says no".

---

## When the answer isn't here

If an architectural question isn't answered by this file or the design doc, do
**not** invent a new pattern. Re-read `docs/design/the-job-app-design.md`, then
emit `PIPELINE_BLOCKED: <precise question>` and let a human decide. Adding an
undocumented pattern is worse than blocking.
