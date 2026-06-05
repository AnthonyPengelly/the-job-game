import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import type { Card, CardId } from '@/minigames/primitives/CardSpread';

export interface CrackTheTumblersParams {
  /** The pins in shuffled (display) order — shown on the CardSpread. */
  cards: Card[];
  /** Card IDs sorted by ascending value — the correct play order. */
  correctOrder: CardId[];
  /** Minimum gap between consecutive sorted values — wider = easier to coordinate. */
  minGap: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Fisher-Yates shuffle using the seeded RNG. */
function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/**
 * Generate Crack the Tumblers parameters from the seeded RNG and the resolved dial.
 *
 * Dial levers (lower dial.level = easier):
 *   - cardCount: fewer pins at lower difficulty (3..7)
 *   - minGap: wider gaps between values at lower difficulty (1..5)
 *
 * The Tech lane drives dial.level via computeDial before generate is called.
 */
export function generate(rng: Rng, dial: Difficulty): CrackTheTumblersParams {
  const cardCount = clamp(Math.round(4 + dial.level * 1.5), 3, 7);
  const minGap = clamp(Math.round(4 - dial.level * 0.8), 1, 5);

  // Build ascending values with minimum gap between consecutive entries.
  const values: number[] = [];
  let current = rng.int(1, 5);
  values.push(current);
  for (let i = 1; i < cardCount; i++) {
    current += minGap + rng.int(0, 2);
    values.push(current);
  }

  // Use value-based IDs so correctOrder varies with seed.
  const sortedCards: Card[] = values.map(v => ({
    id: `pin-${v}` as CardId,
    label: String(v),
  }));

  const correctOrder: CardId[] = sortedCards.map(c => c.id);
  const cards = shuffle(sortedCards, rng);

  return { cards, correctOrder, minGap };
}
