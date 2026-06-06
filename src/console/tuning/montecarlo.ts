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
 */
export function nextModelEvent(
  state: RunState,
  rng: Rng,
  skill: Skill,
  cfg: EngineConfig,
): RunEvent {
  // p = min(0.95, base + growth_bonus(room)) — Python room is 1-indexed → roomIndex+1
  const base = SKILL_VALUES[skill] + playerBonus(state.crew.length);
  const p = Math.min(0.95, base + growthBonus(state.roomIndex + 1));

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
}

export function simulateRun(
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
    rooms: state.history.length,
    win: state.win ?? false,
    loot: state.loot,
    finalScore: state.finalScore ?? 0,
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
}

export interface MonteCarloOpts {
  n: number;
  baseSeed: number;
  skill: Skill;
  headcount: number;
}

/**
 * Run N seeded Monte Carlo runs and return summary distributions.
 * Parameterised so the panel can use a reduced N for interactive speed
 * while the CI harness keeps N=20_000 for statistical stability.
 */
export function runMonteCarlo(cfg: EngineConfig, opts: MonteCarloOpts): MonteCarloResult {
  const { n, baseSeed, skill, headcount } = opts;

  const runs: RunStats[] = [];
  for (let i = 0; i < n; i++) {
    runs.push(simulateRun(baseSeed + i, skill, headcount, cfg));
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

  return { histogram, winRate, medianObstacles, pRoomsOver10, pObstTight, meanLoot, meanScore };
}
