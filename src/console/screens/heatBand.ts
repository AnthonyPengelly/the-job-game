import type { EngineConfig } from '../../engine/config';

export type HeatBand = 'cool' | 'warm' | 'hot';

/**
 * Map a raw heat value to a narration band.
 * Shared by the Offer (pushRun) and ObstacleRoom (roomApproach) teleprompters so
 * scene-setting escalates coherently with the meter: calm while cool, edgy when hot.
 */
export function deriveHeatBand(heat: number, cfg: EngineConfig): HeatBand {
  const runAtThreshold = cfg.heat.hMax * cfg.heat.runAtFraction;
  if (heat < runAtThreshold) return 'cool';
  if (heat < cfg.heat.hMax * 0.75) return 'warm';
  return 'hot';
}
