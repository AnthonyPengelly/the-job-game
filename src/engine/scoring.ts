// Run scoring. Pure function; no RNG, no tunable literals.
// Port of heat-model-simulation.py resolve() scoring.
import type { EngineConfig } from './config';

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
  if (win) {
    const styleFactor = cfg.scoring.lowHeatStyleBonus * (1 - heat / cfg.heat.hMax);
    return loot * (cfg.scoring.winBaseMultiplier + styleFactor);
  }
  return loot * cfg.scoring.bustMultiplier;
}
