// Pure gear-economy helpers.
// No React, no DOM, no Math.random — pure value transformers.
import type { EngineConfig } from './config';

/**
 * Compute the cash value of selling a gear card at the current run depth.
 * Linear curve: base + perRoom * roomIndex.
 * Later rooms yield more — selling deep in the heist is more rewarding.
 */
export function computeGearSellValue(roomIndex: number, cfg: EngineConfig): number {
  return Math.max(0, cfg.gearSellValue.base + cfg.gearSellValue.perRoom * roomIndex);
}
