# TESTING.md — test strategy for The Job

> What we test, where it lives, and which command runs it. The whole strategy
> rests on one fact: **the engine is pure and deterministic**, so tests are fast,
> reliable, and reproducible. The pipeline uses these as merge gates — *how* the
> gates wire into the build is in `ORCHESTRATION.md`; this doc is the *what*.

Balance testing has its own home: `docs/GAME-DESIGN-RIGOUR.md` covers
`sim:check` in depth. This doc places it in the pyramid and covers everything
else.

---

## 1. The test pyramid

Wide and fast at the bottom, narrow and slow at the top. Most confidence comes
from the pure-engine layers; the browser layer proves the experience, not the
arithmetic.

```
            ┌───────────────────────────────────┐
            │  Agent-led QA (Playwright MCP)     │  few, slow, seeded
            │  epic gates + cross-cutting        │
            ├───────────────────────────────────┤
            │  Component tests (mini-games)      │  per game, deterministic
            ├───────────────────────────────────┤
            │  Content validation (content:      │  every preset, every load
            │  validate — Zod)                   │
            ├───────────────────────────────────┤
            │  Balance harness (sim:check)       │  the whole engine, N runs
            ├───────────────────────────────────┤
            │  Property tests (invariants)       │  reachable-state guarantees
            ├───────────────────────────────────┤
            │  Unit tests (every reducer branch) │  many, milliseconds, seeded
            └───────────────────────────────────┘
```

### 1.1 Unit tests — every engine reducer branch

The base of the pyramid. The engine is `(state, event) -> state`, pure, with no
DOM/timers/audio/`Math.random`. So:

- **Every branch of `reduce` has a test.** Every `RunEvent` variant, every
  outcome tier (clean/complication/botched), the escalation ramp boundary
  (~room 5), the escape signal (~Heat 11), the forced Getaway at HMAX (20), the
  Getaway odds curve, scoring with the low-Heat style bonus, scenario currency
  resolution, carried effects (ticking briefcase, 3-room unlock), gear/crew
  mutations, exhaustion rotation, and every GM-override event. This is the EPICS
  E1/E2 acceptance gate: "unit tests cover every reducer branch."
- **Pure + fast + seeded.** A test constructs a `RunState`, applies an event,
  asserts the next state. No mocking of time or randomness — randomness comes
  from a seeded RNG you pass in, so the assertion is exact.
- **RNG reproducibility** is itself tested (EPICS E0): same seed ⇒ same stream.

```ts
it('botch adds +2 Heat and no Loot', () => {
  const s0 = stateAt({ heat: 5, loot: 3 });
  const s1 = reduce(s0, { t: 'RESOLVE_MINIGAME', outcome: 'botched' });
  expect(s1.heat).toBe(7);          // +2, never terminal
  expect(s1.loot).toBe(3);          // no reward
});
```

### 1.2 Property tests — invariants over reachable states

Some guarantees aren't about one branch; they're about *all* reachable states.
Express these as properties (fast-check or an equivalent generator), seeded:

- **GM-override reversibility (no dead-ends).** From any reachable `RunState`,
  every tracked field (Heat, Loot, gear, exhaustion, outcome, phase) can be
  driven to any legal value via override events, and `UNDO_LAST` restores the
  prior state exactly. This is the EPICS E2 gate and `CLAUDE.md` golden rule 1,
  proven as a property: *generate a reachable state → apply an override →
  UNDO_LAST → assert structural equality with the pre-override state.*
- **No dead-ends, structurally.** No engine path terminates a run on a single
  botch (botch is +2 Heat, never a loss — design §"What the model showed"). The
  run only ends via the Offer, the escape-signal run, or the forced Getaway at
  HMAX.
- **Scaling soundness.** For `n = 2..7`, the engine deals a correctly-sized job
  (EPICS E2 gate): `minCommit` floors respected, dial in range, exhaustion
  strength per the scaling profile.

```ts
test.prop([reachableRunState(), legalOverrideEvent()])(
  'override then UNDO_LAST is a no-op',
  (s0, ev) => {
    const s1 = reduce(s0, ev);
    const s2 = reduce(s1, { t: 'UNDO_LAST' });
    expect(s2).toEqual(s0);
  },
);
```

### 1.3 Balance harness — `sim:check`

The Monte Carlo that asserts the design targets (median ~4–5 obstacles, runs
past 10 rooms ≤~3%, win rate bad<avg<good, Loot roughly doubling poor→good, no
single botch ends a run, headcount helps only a little). It runs the **same
engine code** the app ships. Full spec, the assertion table, and tolerances are
in `docs/GAME-DESIGN-RIGOUR.md`. It is a deterministic gate, not an agent.

### 1.4 Content validation — `content:validate`

All content is data, parsed at the boundary (`CLAUDE.md` golden rule 7). Every
preset — scenarios, gear, narration banks, trivia/category banks, sound
manifests, room templates, plus the tuning and scaling packs — has a Zod schema.
`content:validate` loads every preset and validates it. A malformed scenario,
a missing required field, an out-of-range tuning constant, or a scenario that
doesn't resolve every currency **fails loudly here**, in CI — never silently at
the table. This is the EPICS E7 gate ("content validates against schema in CI")
generalised to all preset data.

### 1.5 Component tests — mini-games, deterministic via seed

Each mini-game is a plugin behind the `MiniGame` contract (`generate(rng, dial)`
→ `Component` → `judge`). The contract makes each game testable in isolation:

- **`generate` is seeded** — a component test passes a fixed RNG and asserts the
  generated params are exactly reproducible. "Regenerates fresh each play
  (seeded)" is the EPICS E4 gate.
- **`judge` is pure** — given a challenge state + params, assert the
  clean/complication/botched tier (app *suggests*; GM confirms — §10.4 of the
  app design; the test covers the suggestion logic).
- **Dial wiring** — assert difficulty shifts with committed lane ratings.
- **`minCommit` / variants** — assert the generator never offers an excluded
  game (Assembly Line, Defuse the Alarm) into an ineligible commit slot, and that
  Crack the Tumblers loads its solo variant at one commit (EPICS E5 gate).

Render tests use the React component but keep determinism by injecting the seed
and (for timing games) the audio clock — see §3.

### 1.6 Agent-led QA — Playwright MCP, seeded

The top of the pyramid: the QA agent drives the real SPA through full runs to
prove each epic's **acceptance gate** from `docs/EPICS.md` plus the cross-cutting
invariants (loop never dead-ends, every override works and undoes, player-view
leaks nothing, key states screenshotted). It runs against a **seeded** app so
flows are reproducible and screenshots diffable. Full QA scope is in
`docs/GAME-DESIGN-RIGOUR.md` §6; how QA gates an epic and its bounded fix-loop is
in `ORCHESTRATION.md` §2.

---

## 2. What each command includes

| Command | Type | Property | Balance | Content | Component | Lint/Type | Agent QA |
|---------|:----:|:--------:|:-------:|:-------:|:---------:|:---------:|:--------:|
| `npm run check` | ✅ (unit) | ✅ | — | — | ✅ | ✅ | — |
| `npm run check:full` | ✅ | ✅ | — | — | ✅ | ✅ + sensors | — |
| `npm run sim:check` | — | — | ✅ | (loads preset) | — | — | — |
| `npm run content:validate` | — | — | — | ✅ | — | — | — |

- **`check`** — the fast **inner-loop** alias. Type-check + lint + the unit and
  property tests + component tests. Run it after every logical change. It does
  *not* run the balance Monte Carlo (slower) — that's `sim:check`.
- **`check:full`** — everything in `check` **plus structural sensors** (e.g. the
  import-direction rule: engine may not import React/console; logging discipline;
  no hardcoded tunables). This is the per-task definition-of-done gate
  (`CLAUDE.md` golden rule 8).
- **`sim:check`** — the balance gate (§1.3, `GAME-DESIGN-RIGOUR.md`). Run on
  every design-bearing diff (engine/content/presets) and required green before
  merge.
- **`content:validate`** — Zod validation of all presets (§1.4). Run whenever
  content/presets change; required green before merge.

The deterministic review gate in `ORCHESTRATION.md` §2 is precisely:
`check:full` **+** `sim:check` **+** `content:validate`. All three are scripts,
not agents — free, fast, unambiguous; they gate before any reviewer is spent.

---

## 3. Determinism makes tests reliable

This is the load-bearing property of the whole strategy.

- **One seeded RNG, everywhere.** All randomness flows through the seeded RNG
  (`src/engine/rng.ts`). Tests pass a fixed seed and get an exact, repeatable
  stream. No `Math.random` in the engine — the import-direction/no-randomness
  rule is a sensor, so a stray `Math.random` fails `check:full`.
- **No wall-clock in assertions.** The engine has no timers. Tests never assert
  against `Date.now()` or elapsed real time.
- **Timing tests assert against the audio clock, not `setTimeout`.** The
  metronome games (Beat 16, Follow the Circuit) and the `Timer`/`Metronome`
  primitives are driven by the **Web Audio clock**, not `setTimeout` — that's why
  audio is its own subsystem (`the-job-app-design.md` §2). A timing test
  advances and asserts against the audio clock (a mockable `AudioContext.currentTime`),
  never against `setTimeout`/`jest.advanceTimersByTime` for *audio precision*.
  This is the EPICS E9 gate: "metronome timing accurate (test against audio
  clock, not setTimeout)." `setTimeout`-based timing is inherently jittery and
  would make these tests flaky and the games feel loose.
- **Seeded full runs in QA** mean a failing browser flow is reproducible: re-run
  the same seed and watch the same path.

If a test is flaky, the cause is almost always a hidden non-determinism (real
time, unseeded randomness, an audio path going through `setTimeout`). Fix the
non-determinism; don't add retries or `skip`.

---

## 4. Test file placement & naming

Tests live **next to the code they cover**, mirroring the layer structure from
`docs/ARCHITECTURE.md`.

```
src/engine/
  reduce.ts
  reduce.test.ts            ← unit, per reducer branch
  heat.ts
  heat.test.ts
  rng.ts
  rng.test.ts              ← reproducibility
  overrides.property.test.ts ← property tests (reversibility, no dead-end)
src/minigames/
  safe-crack/
    safe-crack.ts
    safe-crack.test.ts     ← generate/judge/dial (seeded)
    SafeCrack.tsx
    SafeCrack.test.tsx     ← component render (seeded, audio-clock mocked)
src/content/
  presets/
    schema.ts
    schema.test.ts         ← Zod schema unit tests
scripts/
  sim-check.ts             ← the balance harness (run by npm run sim:check)
  content-validate.ts      ← the content gate (npm run content:validate)
```

Conventions:
- `*.test.ts` — unit/integration (Vitest).
- `*.property.test.ts` — property/invariant tests.
- `*.test.tsx` — React component tests.
- Playwright specs for agent QA live under `e2e/` (or `tests/e2e/`) and are
  named per epic gate, e.g. `e2e/E3-room-loop.spec.ts`.

The balance harness and content validator are **scripts**, not `*.test.ts` — they
have their own npm scripts and their own assertion/exit semantics so the pipeline
can run them independently of the Vitest suite.

---

## 5. Coverage expectations

Coverage is a floor, not a target you game — but the floors are real:

- **Engine (`src/engine`): every reducer branch and every override event has a
  test.** This is non-negotiable (EPICS E1/E2 gate). Treat an uncovered engine
  branch as a missing test, not a coverage statistic.
- **Every mini-game** has, at minimum: a seeded `generate` reproducibility test,
  a `judge` tier test, a dial-wiring test, and (where it applies) a
  `minCommit`/variant test (EPICS E4/E5).
- **Every preset** passes `content:validate`; every shipped scenario resolves
  every currency it claims (EPICS E7).
- **Property tests** cover the cross-cutting invariants (override reversibility,
  no dead-ends, scaling soundness) — these guard whole *classes* of state, so
  they're worth more than line coverage.
- **Agent QA** covers each epic's acceptance gate plus the four cross-cutting
  browser checks (no dead-end, overrides work, player-view no-leak,
  screenshots).

A task is **done** when `check:full` passes, and — if it touches
engine/content/presets — `sim:check` and `content:validate` are green too, and
(at epic close) QA is LGTM. A skipped test, a relaxed balance tolerance, or a
loosened schema is a regression: fix the code, not the gate. Recurring test gaps
follow the harness-improvement protocol in `CLAUDE.md` (Inform → Verify →
Correct, logged in `HARNESS_CHANGELOG.md`).
