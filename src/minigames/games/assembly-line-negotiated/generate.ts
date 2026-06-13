import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import { RANK_NAMES } from '@/minigames/games/assembly-line/deal';

export interface AssemblyLineNegotiatedParams {
  /**
   * All thirteen rank names in seeded-shuffled order. The component takes the
   * first `committed.length` as set ranks and the next `decoyCount` as bogus
   * ranks — generate cannot know the headcount.
   */
  rankOrder: string[];
  /** Bogus single cards shuffled into the deal (the main difficulty lever). */
  decoyCount: number;
  /** Challenge timer in seconds. */
  timerSeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Silence (two-player variant) parameters.
 *
 * With two players the "circle" is a straight swap — each passes one card at
 * a time — so the clock is a touch more generous than the full-table game.
 *
 * Dial levers (higher dial.level = harder):
 *   - decoyCount: bogus cards in the deal (1 / 2 — capped at 2 players)
 *   - timerSeconds: less time (50..110)
 *
 * RNG shuffles which ranks are in play; same seed+dial = same params.
 */
export function generate(rng: Rng, dial: Difficulty): AssemblyLineNegotiatedParams {
  const decoyCount = clamp(Math.round(1.5 + dial.level), 1, 5);
  const timerSeconds = clamp(Math.round(85 - dial.level * 12), 50, 110);

  const rankOrder: string[] = [...RANK_NAMES];
  for (let i = rankOrder.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = rankOrder[i]!;
    rankOrder[i] = rankOrder[j]!;
    rankOrder[j] = tmp;
  }

  return { rankOrder, decoyCount, timerSeconds };
}
