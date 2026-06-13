import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import { RANK_NAMES } from './deal';

export interface AssemblyLineParams {
  /**
   * All thirteen rank names in seeded-shuffled order. The component takes the
   * first `committed.length` as the set ranks and the next `decoyCount` as the
   * bogus ranks — generate cannot know the headcount.
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
 * Generate Silence parameters.
 *
 * Silent simultaneous card-passing: the squeeze comes from the bogus cards
 * jamming the circulation (the main lever) and from a tight clock. Wave 4
 * makes bogus cards common — even an easy round has one.
 *
 * Dial levers (higher dial.level = harder):
 *   - decoyCount: bogus cards in the deal (1 easy / 2 medium / ~4 brutal,
 *     capped at the player count by resolveDeal so no hand exceeds five)
 *   - timerSeconds: less time (40..100 — frantic by design)
 *
 * RNG shuffles which ranks are in play; same seed+dial = same params.
 */
export function generate(rng: Rng, dial: Difficulty): AssemblyLineParams {
  const decoyCount = clamp(Math.round(1.5 + dial.level), 1, 5);
  const timerSeconds = clamp(Math.round(75 - dial.level * 12), 40, 100);

  const rankOrder: string[] = [...RANK_NAMES];
  for (let i = rankOrder.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = rankOrder[i]!;
    rankOrder[i] = rankOrder[j]!;
    rankOrder[j] = tmp;
  }

  return { rankOrder, decoyCount, timerSeconds };
}
