import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export interface CrackTheTumblersParams {
  /**
   * How many cards the GM deals face-down to each committed player from a
   * shuffled standard pack. The card values are physical and random — the app
   * never knows them; the GM records each play as in-order or a clash.
   */
  cardsPerPlayer: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Crack the Tumblers parameters from the resolved dial.
 *
 * The deal is physical: shuffle the pack, deal `cardsPerPlayer` to each
 * committed player, players peek only at their own cards, then the crew must
 * play every card to the table in ascending rank order (Ace low, equal ranks
 * may follow each other) without talking. The randomness lives in the
 * physical shuffle, so the RNG is accepted per contract but not consumed.
 *
 * Dial lever (higher dial.level = harder):
 *   - cardsPerPlayer: more cards each = longer silent sequence (1..3)
 */
export function generate(_rng: Rng, dial: Difficulty): CrackTheTumblersParams {
  const cardsPerPlayer = clamp(Math.round(1.5 + dial.level * 0.7), 1, 3);
  return { cardsPerPlayer };
}
