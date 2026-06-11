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
 *
 * A "tier" is a real card-house storey (two leaning cards capped flat), so the
 * range is deliberately human: 2 tiers is a warm-up, 3 is a real build, 4 is a
 * showpiece. Anything taller is fantasy with a standard pack under a clock.
 */
export function generate(_rng: Rng, dial: Difficulty): SteadyHandsParams {
  const targetHeight = clamp(Math.round(2.5 + dial.level * 0.7), 2, 4);
  const timerSeconds = clamp(Math.round(120 - dial.level * 20), 60, 150);
  return { targetHeight, timerSeconds };
}
