# CONVENTIONS.md — The Job

Naming, file structure, and TypeScript patterns. Practical and example-driven.
For *why* the layers exist and which may import which, see
`docs/ARCHITECTURE.md`. For branching, commits, and definition-of-done, see
`docs/WAYS-OF-WORKING.md` — this file references it, never duplicates it.

---

## TypeScript

Strict mode is on and enforced. The golden rules (`CLAUDE.md` #9) are absolute:

- **No `any`.** Use `unknown` at boundaries and narrow with a Zod parse.
- **No `@ts-ignore`** (and no `@ts-expect-error` without a one-line reason).
- **No unjustified `as`.** A cast needs a comment saying why it's sound. Prefer a
  Zod parse or a type guard. The one acceptable bare cast is `as const`.

```ts
// ✗ no
const data = JSON.parse(raw) as Preset;
// ✓ parse at the boundary — the data is now genuinely a Preset
const data = presetSchema.parse(JSON.parse(raw));
```

**Discriminated unions for events and variant shapes.** `RunEvent` is keyed on
`t`; minigame results, scenario effects, and the like follow the same pattern.
Switch exhaustively and assert `never` in the default so a missing branch is a
*compile* error:

```ts
function reduce(state: RunState, event: RunEvent): RunState {
  switch (event.t) {
    case 'START_RUN':       return startRun(state, event);
    case 'CHOOSE_OPTION':   return chooseOption(state, event);
    case 'RESOLVE_MINIGAME': return resolveMinigame(state, event);
    // …every case…
    case 'UNDO_LAST':       return undoLast(state);
    default: {
      const _exhaustive: never = event;   // ← compile error if a case is missing
      return state;
    }
  }
}
```

**Zod schemas co-located with the data they describe.** Schemas for content and
presets live in `src/content/schema/`, next to the data. Derive the static type
from the schema — one source of truth, never two:

```ts
export const scenarioSchema = z.object({ id: z.string(), /* … */ });
export type Scenario = z.infer<typeof scenarioSchema>;
```

**Branded types where an ID could be confused.** IDs are not interchangeable
strings. Brand them so a `GearId` can't be passed where a `PlayerId` is wanted:

```ts
type PlayerId = string & { readonly __brand: 'PlayerId' };
type GearId   = string & { readonly __brand: 'GearId' };
type GameId   = string & { readonly __brand: 'GameId' };
```

**Engine purity is a convention too.** No `Math.random`, `Date.now`, timers,
DOM, or React anywhere under `src/engine/` — lint enforces it. Randomness comes
from the seeded RNG (`src/engine/rng.ts`) passed in explicitly.

---

## Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files & folders | `kebab-case` | `safe-crack/`, `heat.ts`, `crack-the-tumblers.test.ts` |
| Types, interfaces, enums | `PascalCase` | `RunState`, `MiniGame`, `Outcome`, `PlayerId` |
| Functions, variables | `camelCase` | `reduce`, `chooseOption`, `roomIndex` |
| Constants (true consts) | `UPPER_SNAKE` | `HMAX`, `DEFAULT_SEED` — but tunables live in presets, not code |
| React components | `PascalCase` (file `kebab-case.tsx`) | `HeatTrack` in `heat-track.tsx` |
| Zod schemas | `camelCase` + `Schema` | `scenarioSchema`, `presetSchema` |
| Engine event types | union member keyed on `t`, value `UPPER_SNAKE` | `{ t: 'CHOOSE_OPTION' }` |

**Engine event names** match `RunEvent` in the design doc: verb-led
`UPPER_SNAKE` discriminants — `START_RUN`, `CHOOSE_OPTION`, `RESOLVE_MINIGAME`,
`CHOOSE_SCENARIO`, `ASSIGN_GEAR`, `PUSH_ON`, `CALL_GETAWAY`, `RESOLVE_GETAWAY`.
GM-override events follow the same shape: `SET_HEAT`, `ADJUST_HEAT`,
`GRANT_GEAR`, `REMOVE_GEAR`, `SET_EXHAUSTION`, `FORCE_OUTCOME`, `REROLL_ROOM`,
`SKIP_ROOM`, `JUMP_PHASE`, `UNDO_LAST`. New events match this convention exactly.

---

## File structure within a module

A minigame is the canonical shape — a folder per game, one file per concern:

```
src/minigames/games/safe-crack/
├── index.ts            ← the MiniGame<Params, ChallengeState> object (the export)
├── generate.ts         ← generate(rng, dial): Params  — pure, seeded
├── judge.ts            ← judge(state, params): Outcome — pure
├── component.tsx       ← the React referee screen
└── safe-crack.test.ts  ← co-located tests
```

Engine modules keep one concern per file (`heat.ts`, `scoring.ts`,
`generation.ts`, `overrides.ts`) with tests beside them. Prefer named exports;
reserve `default` for React components only. A folder's public surface is its
`index.ts` — other modules import the index, never a sibling's internals.

---

## Imports

**Path aliases, always.** Use `@/engine`, `@/content`, `@/minigames`,
`@/console`, `@/player-view`, `@/platform` (configured in `tsconfig`/Vite in
E0). No deep relative climbs (`../../../`):

```ts
// ✗ no
import { reduce } from '../../../engine/reduce';
// ✓ yes
import { reduce } from '@/engine/reduce';
```

**Never import upward.** The dependency direction is `engine → content →
minigames → console / player-view`, with `platform` as a leaf service the React
surfaces call. The ESLint import-direction rule (`docs/ARCHITECTURE.md` §3)
fails the build on a violation — e.g. anything React-flavoured imported into
`src/engine/`, or `@/console` imported into `@/player-view`. Don't fight the
rule; if you *need* an upward import, you have a layering bug — fix the design or
block.

**Cross-game isolation.** A game never imports another game's internals. Shared
behaviour goes in `src/minigames/primitives/`; the room loop resolves games
through `src/minigames/registry.ts`.

---

## Tests

- **Co-located**, named `<file>.test.ts` (or `.test.tsx` for components):
  `heat.test.ts` beside `heat.ts`, `safe-crack.test.ts` inside the game folder.
- **Every engine function has a unit test; every reducer branch is covered**
  (golden rule #8). Tests pass a fixed seed to the RNG and assert exact results —
  determinism makes this trivial.
- The **balance harness** (`npm run sim:check`) runs the headless Monte Carlo
  over the default preset and asserts the design targets. It uses the *same*
  `reduce` — never a parallel model.
- Content gets **schema-validation tests** (`npm run content:validate`): every
  scenario, preset, and bank parses against its Zod schema in CI.
- Run `npm run check` (unit, fast) in the inner loop; `npm run check:full`
  (typecheck + lint + tests + sensors) before a branch is done.

```ts
import { mulberry32 } from '@/engine/rng';

it('generates the same safe combination for a fixed seed', () => {
  const rng = mulberry32(1312);
  expect(generate(rng, dial(3)).combo).toEqual(generate(mulberry32(1312), dial(3)).combo);
});
```

---

## Presets & content files

Content and tuning are **data, not code** — they never carry logic, and the
engine never hardcodes a tunable.

- **Presets** live in `src/content/presets/`, one folder or file per named
  preset, `kebab-case`: `default`, `spicy`, `gentle`, `playtest-a`. A preset
  bundles its tuning, scaling, and the content it points at. They are swappable
  at boot without a rebuild.
- **Content banks** live under `src/content/` by kind: `scenarios/`, `gear/`,
  `narration/`, `banks/`, `sound/`. IDs inside them are `kebab-case` and stable —
  other data and tests reference them, so renaming an ID is a breaking change.
- Every content file has a Zod schema in `src/content/schema/` and is validated
  by `content:validate`. A malformed scenario fails loudly in CI, never silently
  at the table.
- A new tunable number is a **preset field with a schema entry**, not a `const`
  in the engine. If you're tempted to write `const HMAX = 20` in `heat.ts`, stop
  — it belongs in the preset. See `docs/CONTENT-AND-TUNING.md`.

---

## Commits & branches

Follow `docs/WAYS-OF-WORKING.md` — it is the source of truth. In brief:
small, conventional commits (`feat(engine): …`, `test(minigames): …`,
`fix(console): …`, `chore`, `docs`); one task = one branch
(`epic/<EPIC>.<task>`) = one merge; the branch must be green
(`npm run check:full`) before you emit your pipeline marker. Do not restate the
marker table or the run-book here — read that doc.
