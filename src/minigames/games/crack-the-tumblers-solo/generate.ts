import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import type { Card, CardId } from '@/minigames/primitives/CardSpread';

export interface CrackTheTumblersSoloParams {
  /** Cards in their study display order (ascending). */
  studyCards: Card[];
  /** Cards in shuffled order for the recall phase. */
  recallCards: Card[];
  /** Correct play order (ascending) — what the player must recall. */
  correctOrder: CardId[];
  /** Seconds to study the sequence before the recall phase. */
  studySeconds: number;
  /** Minimum gap between consecutive values (wider = more distinct = easier to remember). */
  minGap: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

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
 * Generate Crack the Tumblers Solo parameters from the seeded RNG and the resolved dial.
 *
 * Dial levers (lower dial.level = easier):
 *   - cardCount: fewer pins at lower difficulty (3..6)
 *   - studySeconds: more study time at lower difficulty (8..20)
 *   - minGap: wider gaps between values at lower difficulty (1..5)
 *
 * Same Tech lane as the parent game; same dial curve applies.
 */
export function generate(rng: Rng, dial: Difficulty): CrackTheTumblersSoloParams {
  const cardCount = clamp(Math.round(4 + dial.level * 1.0), 3, 6);
  const minGap = clamp(Math.round(4 - dial.level * 0.8), 1, 5);
  const studySeconds = clamp(Math.round(14 - dial.level * 3), 8, 20);

  const values: number[] = [];
  let current = rng.int(1, 5);
  values.push(current);
  for (let i = 1; i < cardCount; i++) {
    current += minGap + rng.int(0, 2);
    values.push(current);
  }

  // Use value-based IDs so correctOrder varies with seed.
  const studyCards: Card[] = values.map(v => ({
    id: `pin-${v}` as CardId,
    label: String(v),
  }));

  const correctOrder: CardId[] = studyCards.map(c => c.id);
  const recallCards = shuffle(studyCards, rng);

  return { studyCards, recallCards, correctOrder, studySeconds, minGap };
}
