// Pure gear-economy helpers.
// No React, no DOM, no Math.random — pure value transformers.
import type { EngineConfig } from './config';
import type { GearId, GearGrantDescriptor } from './types';

/**
 * Bonus points an item is worth under the visible sell rule:
 * statBoost → its magnitude (+1 or +2); powerUp → cfg.gearSellValue.powerUpPoints.
 * Unresolved descriptors price by their would-be resolution (bigScore = 2).
 * An unknown GearId prices as 1 point (graceful, never throws at the table).
 */
export function gearBonusPoints(
  item: GearId | GearGrantDescriptor,
  cfg: EngineConfig,
): number {
  if (typeof item === 'object' && item !== null) {
    if (item.kind === 'powerUp') return cfg.gearSellValue.powerUpPoints;
    return item.kind === 'bigScore' ? 2 : 1;
  }
  const def = cfg.gear[String(item)];
  if (def === undefined) return 1;
  return def.kind === 'powerUp' ? cfg.gearSellValue.powerUpPoints : def.magnitude;
}

/**
 * Compute the cash value of selling a gear card at the current run depth.
 * Visible rule: perBonusPoint × bonus points + perRoom × roomIndex.
 * A +2 card sells for twice a +1; later rooms still yield more.
 */
export function computeGearSellValue(
  item: GearId | GearGrantDescriptor,
  roomIndex: number,
  cfg: EngineConfig,
): number {
  const points = gearBonusPoints(item, cfg);
  return Math.max(0, cfg.gearSellValue.perBonusPoint * points + cfg.gearSellValue.perRoom * roomIndex);
}
