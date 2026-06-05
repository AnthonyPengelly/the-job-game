import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import { categoriesBank } from '@/content/banks';

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
 * Generate Categories parameters from the seeded RNG and resolved dial.
 *
 * Dial levers (lower dial.level = easier):
 *   - targetCount: lower target at easier difficulty (4..12)
 *   - timerSeconds: longer timer at easier difficulty (30..90 s)
 *
 * Both category and skipCategory are drawn from the RNG so the same seed
 * always produces the same categories (determinism / replayability).
 */
export function generate(rng: Rng, dial: Difficulty): CategoriesParams {
  const targetCount = clamp(Math.round(8 + dial.level * 1.5), 4, 12);
  const timerSeconds = clamp(Math.round(60 - dial.level * 10), 30, 90);

  const items = categoriesBank.items;
  const category = rng.pick(items);
  const skipCategory = rng.pick(items);

  return { category, skipCategory, targetCount, timerSeconds };
}
