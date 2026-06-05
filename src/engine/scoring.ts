// Run scoring. Pure function; no RNG, no tunable literals.
// Port of heat-model-simulation.py resolve() scoring.
import type { EngineConfig } from './config';

/**
 * Multiplier applied to loot at Getaway resolution — single source of truth
 * for the formula so the console breakdown display and scoreRun stay in sync.
 */
export function getawayMultiplier(
  heat: number,
  win: boolean,
  cfg: EngineConfig,
): number {
  if (win) {
    return cfg.scoring.winBaseMultiplier +
      cfg.scoring.lowHeatStyleBonus * (1 - heat / cfg.heat.hMax);
  }
  return cfg.scoring.bustMultiplier;
}

/**
 * Final run score after Getaway resolution.
 *
 * Python ref:
 *   win  → loot * (1.0 + 0.5 * (1 - H / HMAX))
 *   bust → loot * 0.4
 *
 * @param loot  Loot banked during the run
 * @param heat  Final Heat at Getaway resolution
 * @param win   True if the Getaway succeeded
 * @param cfg   Active EngineConfig
 */
export function scoreRun(
  loot: number,
  heat: number,
  win: boolean,
  cfg: EngineConfig,
): number {
  return loot * getawayMultiplier(heat, win, cfg);
}
