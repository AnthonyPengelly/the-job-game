import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export interface CrackTheTumblersParams {
  /**
   * Total cards the GM deals face-down across the committed crew (split as
   * evenly as possible, every player ≥1). The card values are physical and
   * random — the app never knows them; the GM records each play as in-order
   * or a clash.
   *
   * Wave 4: this is a TOTAL, not a per-player count — two players with one
   * card each was trivially easy, and the count now scales independently of
   * crew size. Suit-order-on-ties (below) keeps even a half-deck hard.
   */
  totalCards: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Crack the Tumblers parameters from the resolved dial.
 *
 * The deal is physical: shuffle the pack, deal `totalCards` across the
 * committed crew, players peek only at their own cards, then the crew plays
 * every card to the table in **ascending rank order, and within equal ranks
 * in suit alphabetical order** (Clubs → Diamonds → Hearts → Spades) — no
 * talking. The suit tiebreak means a long sequence can't be solved by just
 * "play every number in order"; equal ranks still demand silent coordination.
 * The randomness lives in the physical shuffle, so the RNG is accepted per
 * contract but not consumed.
 *
 * Dial lever (higher dial.level = harder):
 *   - totalCards: longer silent sequence. Easy ~6, medium ~12, brutal ~19+
 *     (clamped 4..24).
 */
export function generate(_rng: Rng, dial: Difficulty): CrackTheTumblersParams {
  const totalCards = clamp(Math.round(8 + dial.level * 5), 4, 24);
  return { totalCards };
}
