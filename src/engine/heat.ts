// Pure Heat-model functions. All tunable values are read from EngineConfig;
// no literals in this file. Port of heat-model-simulation.py arithmetic.
import type { EngineConfig } from './config';
import type { Outcome, RunState } from './types';

/**
 * Base heat drip from committing to any obstacle at a given room index.
 * Python ref: base_ob + int(room * ramp_step)
 */
export function obstacleDrip(roomIndex: number, cfg: EngineConfig): number {
  return cfg.obstacleHeat.safe + Math.floor(roomIndex * cfg.escalation.rampPerObstacle);
}

/**
 * True when the greedy option is still available (heat has not crossed the threshold).
 * Python ref: greedy = (H < 0.5 * cfg.HMAX)
 */
export function greedyAvailable(heat: number, cfg: EngineConfig): boolean {
  return heat < cfg.obstacleHeat.greedyBelowFraction * cfg.heat.hMax;
}

/**
 * Extra heat added when the greedy option is taken.
 * Python ref: cfg.greedy_x (the surcharge applied on top of the obstacle drip).
 */
export function greedySurcharge(cfg: EngineConfig): number {
  return cfg.obstacleHeat.greedy;
}

/**
 * Heat added on top of the obstacle drip by the mini-game outcome.
 * Python ref: comp_h (complication) and botch_h (botched); clean is 0.
 */
export function outcomeHeat(outcome: Outcome, cfg: EngineConfig): number {
  return cfg.outcomeHeat[outcome];
}

/**
 * Apply a signed scenario heat swing and clamp the result to >= 0.
 * The caller resolves the magnitude (cfg.scenarioSwing.small or .big) and sign.
 * Python ref: H = max(0, H) after applying +/- scen_s.
 */
export function applyScenarioSwing(heat: number, delta: number): number {
  return Math.max(0, heat + delta);
}

/**
 * True when the escape-signal threshold is reached (the crew may call Getaway).
 * Python ref: room >= 2 and H >= cfg.run_at
 */
export function escapeSignal(
  state: Pick<RunState, 'roomIndex' | 'heat'>,
  cfg: EngineConfig,
): boolean {
  return state.roomIndex >= 2 && state.heat >= cfg.heat.runAtFraction * cfg.heat.hMax;
}

/**
 * True when Heat has reached or exceeded hMax — forced emergency Getaway.
 * Python ref: H >= cfg.HMAX
 */
export function forcedGetaway(heat: number, cfg: EngineConfig): boolean {
  return heat >= cfg.heat.hMax;
}
