import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export interface SteadyHandsParams {
  /** Target tower height in blocks. Higher = harder. */
  targetHeight: number;
  /** Challenge timer duration in seconds. */
  timerSeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Steady Hands parameters from the dial.
 *
 * Pure-skill game — params repeat deterministically with the dial.
 * RNG is accepted per contract but not consumed (no random content to draw).
 *
 * Dial levers (higher dial.level = harder):
 *   - targetHeight: taller at higher difficulty (wider tolerance at lower)
 *   - timerSeconds: less time at higher difficulty
 */
export function generate(_rng: Rng, dial: Difficulty): SteadyHandsParams {
  const targetHeight = clamp(Math.round(5 + dial.level), 3, 9);
  const timerSeconds = clamp(Math.round(90 - dial.level * 15), 45, 120);
  return { targetHeight, timerSeconds };
}
