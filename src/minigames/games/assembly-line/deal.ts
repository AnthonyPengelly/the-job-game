/**
 * Shared deal logic for the Assembly Line family (full + negotiated variant).
 *
 * Set types are ranks from a standard pack, so the GM can build the deck in
 * seconds: pull all four of each set rank, add one decoy card per player at
 * higher dials, shuffle, deal evenly. Every set rank is fully present, so the
 * deal is always solvable by trading; decoys are junk that sharpens Tip-Off.
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

export interface AssemblyDeal {
  /** One rank per committed player — each player's goal is four of one of these. */
  setRanks: string[];
  /** One junk card of each of these ranks is shuffled in (one per player). */
  decoyRanks: string[];
  /** Cards dealt to each player: 4 + decoysPerPlayer. */
  handSize: number;
  /** Total cards the GM pulls from the pack. */
  totalCards: number;
}

/**
 * Resolve the concrete deal for a committed headcount from the generated
 * rank order. Pure; the component calls this with committed.length.
 */
export function resolveDeal(
  rankOrder: readonly string[],
  decoysPerPlayer: number,
  playerCount: number,
): AssemblyDeal {
  const setRanks = rankOrder.slice(0, playerCount) as string[];
  const decoyCount = decoysPerPlayer > 0 ? playerCount : 0;
  const decoyRanks = rankOrder.slice(playerCount, playerCount + decoyCount) as string[];
  const handSize = 4 + decoysPerPlayer;
  return {
    setRanks,
    decoyRanks,
    handSize,
    totalCards: playerCount * 4 + decoyRanks.length,
  };
}
