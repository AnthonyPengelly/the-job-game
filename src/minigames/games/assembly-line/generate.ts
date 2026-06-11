import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import { RANK_NAMES } from './deal';

export interface AssemblyLineParams {
  /**
   * All thirteen rank names in seeded-shuffled order. The component takes the
   * first `committed.length` as the set ranks and (at higher dials) the next
   * `committed.length` as decoy ranks — generate cannot know the headcount.
   */
  rankOrder: string[];
  /** Junk cards per player shuffled into the deal (0 easy, 1 hard). */
  decoysPerPlayer: number;
  /** Challenge timer in seconds. */
  timerSeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Assembly Line parameters.
 *
 * This is a communication-speed game — open table talk is allowed (co-op
 * removes any reason to hide hands), so the squeeze comes from the clock and
 * from decoy junk, not from hidden information.
 *
 * Dial levers (higher dial.level = harder):
 *   - decoysPerPlayer: junk cards muddying the trade at high dial (0..1)
 *   - timerSeconds: less time (45..120 — deliberately tight)
 *
 * RNG shuffles which ranks are in play; same seed+dial = same params.
 */
export function generate(rng: Rng, dial: Difficulty): AssemblyLineParams {
  const decoysPerPlayer = dial.level >= 1 ? 1 : 0;
  const timerSeconds = clamp(Math.round(90 - dial.level * 15), 45, 120);

  const rankOrder: string[] = [...RANK_NAMES];
  for (let i = rankOrder.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = rankOrder[i]!;
    rankOrder[i] = rankOrder[j]!;
    rankOrder[j] = tmp;
  }

  return { rankOrder, decoysPerPlayer, timerSeconds };
}
