// Monte Carlo balance harness — drives the shipping reduce() and asserts design targets.
// Run via: npm run sim:check (vitest run --config vitest.sim.config.ts)
// Deterministic: same BASE_SEED + same preset => identical results every run.
// PRESET env var selects the active preset (default: "default").
// See docs/GAME-DESIGN-RIGOUR.md §3 for the full target table (A–J).
import { describe, it, expect, beforeAll } from 'vitest';
import { loadPreset } from '@/platform/presets/load';
import { mulberry32, initialState, reduce } from '@/engine';
import type { EngineConfig } from '@/engine/config';
import type { RunState, Skill } from '@/engine/types';
import { nextModelEvent } from './model-crew';

// ── Constants ────────────────────────────────────────────────────────────────

const PRESET_ID: string = process.env['PRESET'] ?? 'default';
const BASE_SEED = 1312;
const N = 20_000; // 20k: stable SE≈0.007 for H threshold 1.75 — do not reduce

// ── Types ────────────────────────────────────────────────────────────────────

interface RunStats {
  obstacles: number;
  rooms: number;
  win: boolean;
  loot: number;
  finalScore: number;
}

interface CellStats {
  medianObstacles: number;
  pRoomsOver10: number;
  pObstTight: number;
  winRate: number;
  meanLoot: number;
  meanScore: number; // finalScore = loot × win/bust multiplier; amplifies skill gap vs raw loot
}

// ── Simulation ───────────────────────────────────────────────────────────────

function simulateRun(
  seed: number,
  skill: Skill,
  headcount: number,
  cfg: EngineConfig,
): RunStats {
  // Two independent RNG streams: engine (embedded in rngState) and harness.
  // XOR-mix the seed so the two streams differ for every run.
  const harnessRng = mulberry32(seed ^ 0x9e3779b9);

  const crew = Array.from({ length: headcount }, (_, i) => ({ name: `P${i}` }));
  let state: RunState = reduce(
    initialState(seed),
    { t: 'START_RUN', crew, seed },
    cfg,
  );

  while (state.phase !== 'result') {
    state = reduce(state, nextModelEvent(state, harnessRng, skill, cfg), cfg);
  }

  return {
    obstacles: state.obstacleCount,
    // history.length = actual rooms processed (both obstacle and scenario)
    rooms: state.history.length,
    win: state.win ?? false,
    loot: state.loot,
    finalScore: state.finalScore ?? 0,
  };
}

function computeCell(skill: Skill, headcount: number, cfg: EngineConfig): CellStats {
  const runs: RunStats[] = [];
  for (let i = 0; i < N; i++) {
    runs.push(simulateRun(BASE_SEED + i, skill, headcount, cfg));
  }

  const sortedObst = runs.map(r => r.obstacles).sort((a, b) => a - b);
  const medianObstacles = sortedObst[Math.floor(N / 2)] ?? 0;
  const pRoomsOver10 = runs.filter(r => r.rooms > 10).length / N;
  const pObstTight = runs.filter(r => Math.abs(r.obstacles - medianObstacles) <= 1).length / N;
  const winRate = runs.filter(r => r.win).length / N;
  const meanLoot = runs.reduce((s, r) => s + r.loot, 0) / N;
  const meanScore = runs.reduce((s, r) => s + r.finalScore, 0) / N;

  return { medianObstacles, pRoomsOver10, pObstTight, winRate, meanLoot, meanScore };
}

// ── Test state ────────────────────────────────────────────────────────────────

let cfg: EngineConfig;
let avgN4: CellStats;
let badN4: CellStats;
let goodN4: CellStats;
let avgN2: CellStats;
let avgN7: CellStats;

beforeAll(() => {
  cfg = loadPreset(PRESET_ID);
  // Compute the 5 cells needed to cover all assertions A–J.
  avgN4 = computeCell('avg', 4, cfg);
  badN4 = computeCell('bad', 4, cfg);
  goodN4 = computeCell('good', 4, cfg);
  avgN2 = computeCell('avg', 2, cfg);
  avgN7 = computeCell('avg', 7, cfg);
}, 300_000);

// ── Assertions (A–J) ─────────────────────────────────────────────────────────
// On failure: observed value, target, seed, preset are all printed.
// All assertions run even if earlier ones fail (each is its own it() block).

describe(`balance assertions — preset:${PRESET_ID} seed:${BASE_SEED} N:${N}`, () => {

  it('A: median obstacles in 4–5 (avg/n4)', () => {
    const obs = avgN4.medianObstacles;
    expect(
      obs,
      `A: median obstacles = ${obs} outside band [4,5] (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeGreaterThanOrEqual(4);
    expect(
      obs,
      `A: median obstacles = ${obs} outside band [4,5] (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeLessThanOrEqual(5);
  });

  it('B: P(rooms > 10) ≤ 0.05 (avg/n4)', () => {
    const p = avgN4.pRoomsOver10;
    expect(
      p,
      `B: P(rooms>10) = ${p.toFixed(3)} exceeds 0.05 (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeLessThanOrEqual(0.05);
  });

  it('C: P(|obst − median| ≤ 1) ≥ 0.93 (avg/n4)', () => {
    // HUMAN SIGN-OFF E1.7 — threshold is 0.93, not 0.95.
    // Dual-RNG architecture (separate streams for room gen and outcome rolls)
    // structurally produces P≈0.940. DO NOT raise without resolving dual-RNG.
    const p = avgN4.pObstTight;
    expect(
      p,
      `C: run-length tightness = ${p.toFixed(3)} below 0.93 (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeGreaterThanOrEqual(0.93);
  });

  it('D: win rate — bad crew in [0.32, 0.42] (n4)', () => {
    const w = badN4.winRate;
    expect(
      w,
      `D: win_bad = ${w.toFixed(3)} outside [0.32,0.42] (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeGreaterThanOrEqual(0.32);
    expect(
      w,
      `D: win_bad = ${w.toFixed(3)} outside [0.32,0.42] (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeLessThanOrEqual(0.42);
  });

  it('E: win rate — avg crew in [0.43, 0.53] (n4)', () => {
    const w = avgN4.winRate;
    expect(
      w,
      `E: win_avg = ${w.toFixed(3)} outside [0.43,0.53] (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeGreaterThanOrEqual(0.43);
    expect(
      w,
      `E: win_avg = ${w.toFixed(3)} outside [0.43,0.53] (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeLessThanOrEqual(0.53);
  });

  it('F: win rate — good crew in [0.52, 0.62] (n4)', () => {
    const w = goodN4.winRate;
    expect(
      w,
      `F: win_good = ${w.toFixed(3)} outside [0.52,0.62] (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeGreaterThanOrEqual(0.52);
    expect(
      w,
      `F: win_good = ${w.toFixed(3)} outside [0.52,0.62] (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeLessThanOrEqual(0.62);
  });

  it('G: skill ordering — win_bad < win_avg < win_good (n4)', () => {
    const { winRate: b } = badN4;
    const { winRate: a } = avgN4;
    const { winRate: g } = goodN4;
    expect(
      b,
      `G: skill ordering broken: bad=${b.toFixed(3)} avg=${a.toFixed(3)} good=${g.toFixed(3)}`,
    ).toBeLessThan(a);
    expect(
      a,
      `G: skill ordering broken: bad=${b.toFixed(3)} avg=${a.toFixed(3)} good=${g.toFixed(3)}`,
    ).toBeLessThan(g);
  });

  it('H: score_good ≥ 1.75 × score_bad (n4)', () => {
    // HUMAN SIGN-OFF E1.7 — uses finalScore (loot × win/bust multiplier), not
    // raw loot. Score amplifies skill separation via win rate differential.
    // Raw loot ratio is only ~1.47×; score ratio is ~1.79×.
    // Threshold is 1.75, not 1.80 — deterministic scenario policy vs Python's
    // probabilistic one compresses the ratio slightly. DO NOT revert to raw
    // loot or raise threshold to 1.80 without sign-off.
    const ratio = goodN4.meanScore / (badN4.meanScore || 1);
    expect(
      ratio,
      `H: score ratio = ${ratio.toFixed(2)}× (good=${goodN4.meanScore.toFixed(2)}, bad=${badN4.meanScore.toFixed(2)}) < 1.75× (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeGreaterThanOrEqual(1.75);
  });

  it('I: headcount spread 0.03 ≤ win_7 − win_2 ≤ 0.12 (avg skill)', () => {
    const spread = avgN7.winRate - avgN2.winRate;
    expect(
      spread,
      `I: headcount spread = ${spread.toFixed(3)} outside [0.03,0.12] (win_2=${avgN2.winRate.toFixed(3)}, win_7=${avgN7.winRate.toFixed(3)}, seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeGreaterThanOrEqual(0.03);
    expect(
      spread,
      `I: headcount spread = ${spread.toFixed(3)} outside [0.03,0.12] (seed ${BASE_SEED}, preset ${PRESET_ID})`,
    ).toBeLessThanOrEqual(0.12);
  });

  // J: structural — not statistical. Checks preset config and a direct engine call.
  it('J: botch outcome heat = 2 (structural)', () => {
    expect(
      cfg.outcomeHeat.botched,
      `J: outcomeHeat.botched = ${cfg.outcomeHeat.botched} must be 2 per design`,
    ).toBe(2);
  });

  it('J: botch never terminates a run — routes to offer (structural)', () => {
    // Drive through the engine's own path to reach minigame phase — avoids
    // hand-casting branded GameId. Scan seeds until we land on an obstacle room.
    let state = reduce(initialState(999), { t: 'START_RUN', crew: [{ name: 'P0' }], seed: 999 }, cfg);
    for (let s = 1; state.currentRoom?.kind !== 'obstacle' && s <= 100; s++) {
      state = reduce(initialState(999 + s), { t: 'START_RUN', crew: [{ name: 'P0' }], seed: 999 + s }, cfg);
    }
    const { currentRoom } = state;
    if (currentRoom === null || currentRoom.kind !== 'obstacle') {
      throw new Error('J: no obstacle room found in first 101 seeds');
    }
    const firstOption = currentRoom.options[0];
    if (firstOption === undefined) throw new Error('J: obstacle room has no options');

    const minigameState = reduce(
      state,
      { t: 'CHOOSE_OPTION', optionId: firstOption.id, committed: state.crew.map(p => p.id) },
      cfg,
    );
    const next = reduce(minigameState, { t: 'RESOLVE_MINIGAME', outcome: 'botched' }, cfg);
    expect(
      next.phase,
      'J: a botched outcome must route to offer, not terminate the run',
    ).toBe('offer');
  });
});
