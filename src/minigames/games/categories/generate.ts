import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export interface CategoriesParams {
  /** The active category prompt drawn from the bank. */
  category: string;
  /** Alternate category pre-generated for the Skip boost. */
  skipCategory: string;
  /** Number of valid answers the crew must reach to clear the challenge. */
  targetCount: number;
  /** Countdown timer length in seconds. */
  timerSeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Factory that binds the categories item bank to a generate function.
 *
 * Dial levers (lower dial.level = easier):
 *   - targetCount: lower target at easier difficulty (4..12)
 *   - timerSeconds: longer timer at easier difficulty (30..90 s)
 *
 * Both category and skipCategory are drawn from the RNG so the same seed
 * always produces the same categories (determinism / replayability).
 *
 * skipCategory is drawn in a loop until it differs from category, guarded by
 * items.length > 1 to avoid infinite loops when the bank has only one item.
 */
export function makeGenerate(items: string[]) {
  return function generate(rng: Rng, dial: Difficulty): CategoriesParams {
    const targetCount = clamp(Math.round(8 + dial.level * 1.5), 4, 12);
    const timerSeconds = clamp(Math.round(60 - dial.level * 10), 30, 90);

    const category = rng.pick(items);
    let skipCategory = rng.pick(items);
    if (items.length > 1) {
      while (skipCategory === category) {
        skipCategory = rng.pick(items);
      }
    }

    return { category, skipCategory, targetCount, timerSeconds };
  };
}
