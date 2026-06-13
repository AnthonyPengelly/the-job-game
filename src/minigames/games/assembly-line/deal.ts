/**
 * Shared deal logic for Silence (the full-team game + its 2-player variant).
 *
 * Wave 4: replaces the old "Assembly Line" trading game. The crew sits in a
 * circle and, on a silent count, everyone passes ONE unwanted card to their
 * left simultaneously — fast as they can — collecting four of a kind. Lay a
 * set down and you're safe. Bogus cards (single ranks no one can complete)
 * jam the circulation and someone ends up stuck with them.
 *
 * Set types are ranks from a standard pack, so the GM builds the deck in
 * seconds: pull all four of one rank per player, add some single bogus cards
 * of OTHER ranks, shuffle, deal four each (the bogus cards make some players
 * hold five). Every set rank is fully present, so the round is always
 * solvable; the bogus cards are pure friction (more bogus = harder).
 */

export const RANK_NAMES = [
  'Aces', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens',
  'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings',
] as const;

const SINGULAR: Record<string, string> = {
  Aces: 'Ace', Twos: 'Two', Threes: 'Three', Fours: 'Four', Fives: 'Five',
  Sixes: 'Six', Sevens: 'Seven', Eights: 'Eight', Nines: 'Nine', Tens: 'Ten',
  Jacks: 'Jack', Queens: 'Queen', Kings: 'King',
};

export function singularRank(rank: string): string {
  return SINGULAR[rank] ?? rank;
}

export interface SilenceDeal {
  /** One rank per committed player — each player's goal is four of one of these. */
  setRanks: string[];
  /** Single bogus cards of these (distinct, non-set) ranks are shuffled in. */
  decoyRanks: string[];
  /** How many players will be dealt a fifth (bogus) card. */
  decoyCount: number;
  /** Total cards the GM pulls from the pack (4 × players + bogus). */
  totalCards: number;
}

/**
 * Resolve the concrete deal for a committed headcount from the generated rank
 * order and the dial-driven decoy count. Pure; the component calls it with
 * committed.length. The decoy count is capped at the player count so no one
 * ever holds more than five cards (one bogus).
 */
export function resolveDeal(
  rankOrder: readonly string[],
  decoyCount: number,
  playerCount: number,
): SilenceDeal {
  const setRanks = rankOrder.slice(0, playerCount) as string[];
  const effectiveDecoys = Math.max(0, Math.min(decoyCount, playerCount));
  const decoyRanks = rankOrder.slice(playerCount, playerCount + effectiveDecoys) as string[];
  return {
    setRanks,
    decoyRanks,
    decoyCount: decoyRanks.length,
    totalCards: playerCount * 4 + decoyRanks.length,
  };
}
