# sim/ — balance harness

Headless Monte Carlo that drives the **shipping** `reduce()` and asserts the design targets from `docs/GAME-DESIGN-RIGOUR.md` §3.

## Files

- `balance.sim.ts` — 20k × 5 cells of seeded runs; asserts targets A–J. Imports the shared Monte Carlo core from `src/console/tuning/montecarlo.ts`.

## Run

```bash
npm run sim:check               # default preset
PRESET=spicy npm run sim:check  # named preset
```

`sim:check` exits non-zero on any breached target and prints observed vs. target + seed + preset for every failure. All assertions run before exiting — the output lists every breach, not just the first.

## Determinism

Fixed `BASE_SEED = 1312`. Same seed + same preset ⇒ identical distribution on every run. Re-running with the reported seed reproduces a failing run for debugging.

## Not in normal test suite

`sim/**` is excluded from `npm test` and `npm run check:full`. It is a separate gate run on design-bearing diffs (`engine/`, `content/`, `presets/`).
