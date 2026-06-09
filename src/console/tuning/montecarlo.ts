// Shared browser-safe Monte Carlo core — single source of truth for both the
// in-app tuning panel (E11.4+) and the CI balance harness (sim/balance.sim.ts).
//
// No Node.js fs, no Math.random, no React, no DOM.
// All randomness flows through the seeded RNG (mulberry32).
//
// Crew policy ported from sim/model-crew.ts (originally from heat-model-simulation.py).
// simulateRun / runMonteCarlo extracted from sim/balance.sim.ts.

import { mulberry32, initialState, reduce } from '@/engine';
import { greedyAvailable, forcedGetaway } from '@/engine/heat';
import { getawayOdds } from '@/engine/getaway';
import type { EngineConfig } from '@/engine/config';
import type { RunState, RunEvent, Skill, ObstacleRoom, ScenarioChoiceDef } from '@/engine/types';
import type { Rng } from '@/engine/rng';

// ── Crew policy (port of heat-model-simulation.py SKILL bands + decision logic) ──

/** Expected heat delta for a choice: effect's delta, or average of success/failure for rolls. */
function choiceHeatDelta(c: ScenarioChoiceDef): number {
  if ('effect' in c) return c.effect.heatDelta;
  return (c.roll.success.heatDelta + c.roll.failure.heatDelta) / 2;
}

/** Expected loot delta for a choice: effect's delta, or average of success/failure for rolls. */
function choiceLootDelta(c: ScenarioChoiceDef): number {
  if ('effect' in c) return c.effect.lootDelta;
  return (c.roll.success.lootDelta + c.roll.failure.lootDelta) / 2;
}

// Python: SKILL = {'bad': 0.45, 'avg': 0.65, 'good': 0.82}
export const SKILL_VALUES: Record<Skill, number> = {
  bad: 0.45,
  avg: 0.65,
  good: 0.82,
};

// Python: {2:-0.04,3:-0.02,4:0.0,5:0.02,7:0.05}.get(n,0.0)
export function playerBonus(n: number): number {
  const table: Record<number, number> = { 2: -0.04, 3: -0.02, 4: 0.0, 5: 0.02, 7: 0.05 };
  return table[n] ?? 0.0;
}

// Python: min(0.12, 0.015*i) — caller passes roomIndex+1 (Python room is 1-indexed)
export function growthBonus(room: number): number {
  return Math.min(0.12, 0.015 * room);
}

// Harness conversion factor: 1 dial-level unit maps to this many probability units.
// The tunable magnitudes live in cfg.scaling.heatDial; this constant owns
// the dial-level → success-probability interpretation in the harness model.
// 1 dial-level increase (a typical preset step) → 5 pp reduction in clean probability.
export const DIAL_LEVEL_TO_P = 0.05;

// Obstacle band boundaries for per-band clean-rate instrumentation.
// "Early" = obstacle encounters 0..(BAND_EARLY_MAX_OBSTACLE-1).
// "Late"  = obstacle encounters >= BAND_LATE_MIN_OBSTACLE.
export const BAND_EARLY_MAX_OBSTACLE = 2;
export const BAND_LATE_MIN_OBSTACLE = 3;

// Port of Python's outcome(rng, p): uses 2 RNG draws on success, 2 on failure.
function rollOutcome(rng: Rng, p: number): 'clean' | 'complication' | 'botched' {
  if (rng.next() < p) {
    return rng.next() < 0.7 ? 'clean' : 'complication';
  }
  return rng.next() < 0.4 ? 'complication' : 'botched';
}

// Port of Python's scenario branch: picks a choice id from the active scenario room.
// Hot scenario (H > 0.6*HMAX): prefer cooling.
// Normal scenario: prefer loot, with p-driven fallback to heat.
function pickScenarioChoiceId(
  state: RunState,
  rng: Rng,
  p: number,
  cfg: EngineConfig,
): string {
  const room = state.currentRoom;
  if (room === null || room.kind !== 'scenario') {
    throw new Error('pickScenarioChoiceId: expected scenario room');
  }
  const template = cfg.roomTemplates.scenarios.find(t => t.id === room.templateId);
  if (template === undefined) {
    throw new Error(`pickScenarioChoiceId: template not found: ${room.templateId}`);
  }

  const [t0, t1] = template.choices;
  const [c0, c1] = room.choices;

  const h0 = choiceHeatDelta(t0);
  const h1 = choiceHeatDelta(t1);
  const l0 = choiceLootDelta(t0);
  const l1 = choiceLootDelta(t1);

  const coolIsIdx0 = h0 <= h1;
  const coolId = coolIsIdx0 ? c0.id : c1.id;
  const heatId = coolIsIdx0 ? c1.id : c0.id;

  const lootIsIdx0 = l0 > l1 ? true : l1 > l0 ? false : coolIsIdx0;
  const lootId = lootIsIdx0 ? c0.id : c1.id;

  const isHot = state.heat > 0.6 * cfg.heat.hMax;

  if (isHot) {
    if (rng.next() < 0.5) return coolId;
    return rng.next() < p ? coolId : heatId;
  } else {
    if (rng.next() < 0.7) return lootId;
    return rng.next() < p ? lootId : heatId;
  }
}

/**
 * Given the current RunState, return the next event for the model crew to dispatch.
 * Reproduces the branching of heat-model-simulation.py run_once():
 *   obstacle: greedy while heat < 0.5*hMax; outcome from p with -0.1 greedy penalty
 *   scenario: cool/loot branches per Python
 *   offer:    escape when escapeSignal or forced; safety cap at roomIndex >= 39 (~room 40)
 *   getaway:  RESOLVE_GETAWAY with no win override — engine's seeded RNG decides
 *
 * levelled: when true (default) the crew earns the room-growth offset, modelling
 *   investment in relevant skill lanes. When false (un-levelled crew) the growth
 *   offset is 0 — late rooms give no free probability bonus.
 */
export function nextModelEvent(
  state: RunState,
  rng: Rng,
  skill: Skill,
  cfg: EngineConfig,
  levelled = true,
): RunEvent {
  // p = min(0.95, base + growth − heatPenalty)
  // growth: levelled crew earns full room-growth offset; un-levelled crew earns none.
  // heatPenalty: dial-level contribution from heatDial preset curve mapped to probability
  //   via DIAL_LEVEL_TO_P. When heatDial={0,0} the penalty is always 0.
  const base = SKILL_VALUES[skill] + playerBonus(state.crew.length);
  const growth = levelled ? growthBonus(state.roomIndex + 1) : 0;
  const hd = cfg.scaling.heatDial;
  const heatPenalty = DIAL_LEVEL_TO_P * (hd.perHeat * state.heat + hd.perRoom * state.roomIndex);
  const p = Math.min(0.95, base + growth - heatPenalty);

  switch (state.phase) {
    case 'briefing': {
      return { t: 'OVERRIDE_SET_PHASE', phase: 'room' };
    }

    case 'room': {
      const room = state.currentRoom;
      if (room === null) throw new Error('nextModelEvent: room phase but no currentRoom');

      if (room.kind === 'obstacle') {
        const wantGreedy = greedyAvailable(state.heat, cfg);
        const preferred = room.options.find(o => o.greedy === wantGreedy);
        const fallback = room.options[0];
        if (fallback === undefined) throw new Error('nextModelEvent: obstacle has no options');
        const option = preferred ?? fallback;
        return {
          t: 'CHOOSE_OPTION',
          optionId: option.id,
          committed: state.crew.map(pl => pl.id),
        };
      } else {
        if (room.resolvedRoll !== undefined) {
          return { t: 'ACK_SCENARIO_ROLL' };
        }
        if (room.pendingRoll !== undefined) {
          return { t: 'RESOLVE_SCENARIO_ROLL' };
        }
        const choiceId = pickScenarioChoiceId(state, rng, p, cfg);
        const template = cfg.roomTemplates.scenarios.find(t => t.id === room.templateId);
        const choiceDef = template?.choices.find(c => c.id === choiceId);
        const isRollChoice = choiceDef !== undefined && 'roll' in choiceDef;
        if (isRollChoice && state.crew.length > 0) {
          return { t: 'CHOOSE_SCENARIO', choiceId, attemptedBy: state.crew[0]!.id };
        }
        return { t: 'CHOOSE_SCENARIO', choiceId };
      }
    }

    case 'minigame': {
      const room = state.currentRoom as ObstacleRoom;
      const option = room.options.find(o => o.id === room.committedOptionId);
      if (option === undefined) throw new Error('nextModelEvent: committed option not found');
      const outcome = rollOutcome(rng, p - (option.greedy ? 0.1 : 0));
      return { t: 'RESOLVE_MINIGAME', outcome };
    }

    case 'offer': {
      if (state.escapeSignal || forcedGetaway(state.heat, cfg) || state.roomIndex >= 39) {
        return { t: 'CALL_GETAWAY' };
      }
      return { t: 'PUSH_ON' };
    }

    case 'getaway': {
      const odds = getawayOdds(state.heat, cfg, state.crew.length, SKILL_VALUES[skill]);
      return { t: 'RESOLVE_GETAWAY', win: rng.next() < odds };
    }

    default: {
      throw new Error(`nextModelEvent: unexpected phase "${state.phase}"`);
    }
  }
}

// ── Simulation core ───────────────────────────────────────────────────────────

interface RunStats {
  obstacles: number;
  rooms: number;
  win: boolean;
  loot: number;
  finalScore: number;
  /** Clean outcomes in the early band (obstacle index < BAND_EARLY_MAX_OBSTACLE). */
  earlyClean: number;
  /** Total obstacles in the early band. */
  earlyTotal: number;
  /** Clean outcomes in the late band (obstacle index >= BAND_LATE_MIN_OBSTACLE). */
  lateClean: number;
  /** Total obstacles in the late band. */
  lateTotal: number;
}

export function simulateRun(
  seed: number,
  skill: Skill,
  headcount: number,
  cfg: EngineConfig,
  levelled = true,
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

  let earlyClean = 0;
  let earlyTotal = 0;
  let lateClean = 0;
  let lateTotal = 0;

  while (state.phase !== 'result') {
    const event = nextModelEvent(state, harnessRng, skill, cfg, levelled);

    // Track band clean-rates by inspecting RESOLVE_MINIGAME events before reducing.
    // state.obstacleCount is the 0-based index of the obstacle being resolved.
    if (event.t === 'RESOLVE_MINIGAME') {
      const idx = state.obstacleCount;
      if (idx < BAND_EARLY_MAX_OBSTACLE) {
        earlyTotal++;
        if (event.outcome === 'clean') earlyClean++;
      }
      if (idx >= BAND_LATE_MIN_OBSTACLE) {
        lateTotal++;
        if (event.outcome === 'clean') lateClean++;
      }
    }

    state = reduce(state, event, cfg);
  }

  return {
    obstacles: state.obstacleCount,
    rooms: state.history.length,
    win: state.win ?? false,
    loot: state.loot,
    finalScore: state.finalScore ?? 0,
    earlyClean,
    earlyTotal,
    lateClean,
    lateTotal,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** One bin in the obstacle-count histogram. */
export interface RunLengthBin {
  obstacles: number;
  count: number;
}

/** Summary distributions returned by runMonteCarlo — used by the panel (E11.4+) and CI harness. */
export interface MonteCarloResult {
  /** Obstacle-count histogram across all simulated runs. */
  histogram: RunLengthBin[];
  winRate: number;
  medianObstacles: number;
  pRoomsOver10: number;
  /** P(|obstacles − median| ≤ 1) — run-length tightness (assertion C). */
  pObstTight: number;
  meanLoot: number;
  /** mean(loot × win/bust multiplier) — amplifies skill gap vs raw loot (assertion H). */
  meanScore: number;
  /**
   * Fraction of early-band obstacle encounters (index < BAND_EARLY_MAX_OBSTACLE)
   * that resolved as "clean" across all runs. NaN if no early obstacles encountered.
   */
  earlyCleanRate: number;
  /**
   * Fraction of late-band obstacle encounters (index >= BAND_LATE_MIN_OBSTACLE)
   * that resolved as "clean" across all runs. NaN if no late obstacles encountered.
   */
  lateCleanRate: number;
}

export interface MonteCarloOpts {
  n: number;
  baseSeed: number;
  skill: Skill;
  headcount: number;
  /**
   * When true (default) the model crew earns the room-growth probability bonus,
   * modelling a crew that has invested in relevant skill lanes (levelled up).
   * When false, the growth bonus is 0 — late rooms provide no free p boost.
   * The existing A–J balance cells all run at levelled=true (the default).
   */
  levelled?: boolean;
}

/**
 * Run N seeded Monte Carlo runs and return summary distributions.
 * Parameterised so the panel can use a reduced N for interactive speed
 * while the CI harness keeps N=20_000 for statistical stability.
 */
export function runMonteCarlo(cfg: EngineConfig, opts: MonteCarloOpts): MonteCarloResult {
  const { n, baseSeed, skill, headcount, levelled = true } = opts;

  const runs: RunStats[] = [];
  for (let i = 0; i < n; i++) {
    runs.push(simulateRun(baseSeed + i, skill, headcount, cfg, levelled));
  }

  // Obstacle-count histogram
  const countsByObst = new Map<number, number>();
  for (const r of runs) {
    countsByObst.set(r.obstacles, (countsByObst.get(r.obstacles) ?? 0) + 1);
  }
  const histogram: RunLengthBin[] = [...countsByObst.entries()]
    .sort(([a], [b]) => a - b)
    .map(([obstacles, count]) => ({ obstacles, count }));

  const sortedObst = runs.map(r => r.obstacles).sort((a, b) => a - b);
  const medianObstacles = sortedObst[Math.floor(n / 2)] ?? 0;
  const pRoomsOver10 = runs.filter(r => r.rooms > 10).length / n;
  const pObstTight = runs.filter(r => Math.abs(r.obstacles - medianObstacles) <= 1).length / n;
  const winRate = runs.filter(r => r.win).length / n;
  const meanLoot = runs.reduce((s, r) => s + r.loot, 0) / n;
  const meanScore = runs.reduce((s, r) => s + r.finalScore, 0) / n;

  const totalEarlyClean = runs.reduce((s, r) => s + r.earlyClean, 0);
  const totalEarlyTotal = runs.reduce((s, r) => s + r.earlyTotal, 0);
  const totalLateClean  = runs.reduce((s, r) => s + r.lateClean, 0);
  const totalLateTotal  = runs.reduce((s, r) => s + r.lateTotal, 0);
  const earlyCleanRate = totalEarlyTotal > 0 ? totalEarlyClean / totalEarlyTotal : NaN;
  const lateCleanRate  = totalLateTotal  > 0 ? totalLateClean  / totalLateTotal  : NaN;

  return {
    histogram,
    winRate,
    medianObstacles,
    pRoomsOver10,
    pObstTight,
    meanLoot,
    meanScore,
    earlyCleanRate,
    lateCleanRate,
  };
}
