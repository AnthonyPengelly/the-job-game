import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export interface CrackTheTumblersSoloParams {
  /** How many random cards the GM deals face-up in a row for the study phase. */
  cardCount: number;
  /** Seconds the player gets to study the row before it is flipped face-down. */
  studySeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Crack the Tumblers Solo parameters from the resolved dial.
 *
 * The memory test is physical: the GM deals `cardCount` random cards face-up
 * in a row, the player studies them for `studySeconds`, the GM flips them
 * face-down in place, and the player must flip them back one at a time in
 * ascending rank order (Ace low, equal ranks may follow each other). Every
 * flip is public, so the whole table can verify each reveal — the GM records
 * in-order / clash on the console. The randomness lives in the physical
 * shuffle; the RNG is accepted per contract but not consumed.
 *
 * Dial levers (higher dial.level = harder):
 *   - cardCount: more positions to memorise (4..8)
 *   - studySeconds: less time to study (6..25)
 */
export function generate(_rng: Rng, dial: Difficulty): CrackTheTumblersSoloParams {
  const cardCount = clamp(Math.round(5 + dial.level), 4, 8);
  const studySeconds = clamp(Math.round(15 - dial.level * 3), 6, 25);
  return { cardCount, studySeconds };
}
