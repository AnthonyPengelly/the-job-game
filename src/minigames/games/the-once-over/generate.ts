import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import type { Card, CardId } from '@/minigames/primitives/CardSpread';

export type ChangeType = 'swap' | 'alter' | 'rotate' | 'remove';

export interface AppliedChange {
  type: ChangeType;
  /** Card IDs involved in this change. */
  cardIds: CardId[];
}

export interface OnceOverParams {
  /** Original card spread shown during the study phase. */
  originalCards: Card[];
  /** Card spread after all changes are applied — crew identifies what changed. */
  modifiedCards: Card[];
  /** The changes made (what the app knows). */
  changes: AppliedChange[];
  /** Flat list of all changed card IDs (convenience for judge). */
  changedCardIds: CardId[];
  /** Number of change events applied. */
  changeCount: number;
  /** Study timer duration in seconds. */
  studySeconds: number;
}

const SUITS = ['♥', '♦', '♣', '♠'] as const;
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
type Suit = (typeof SUITS)[number];
type Value = (typeof VALUES)[number];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function alterSuit(suit: Suit, rng: Rng): Suit {
  const others = SUITS.filter(s => s !== suit);
  return others[rng.int(0, others.length - 1)] as Suit;
}

/**
 * Generate The Once-Over parameters from the seeded RNG and the resolved dial.
 *
 * Dial levers (lower dial.level = easier):
 *   - studySeconds: more time at lower difficulty (15..30 s)
 *   - changeCount: fewer changes at lower difficulty (1..3)
 *
 * Card count is always 8–10 (varied by seed, not difficulty).
 * Same seed + same dial ⇒ identical params (no Math.random).
 */
export function generate(rng: Rng, dial: Difficulty): OnceOverParams {
  const cardCount = 8 + rng.int(0, 2); // 8, 9, or 10
  const studySeconds = clamp(Math.round(25 - dial.level * 5), 15, 30);
  const changeCount = clamp(Math.round(1 + dial.level * 0.5), 1, 3);

  // Build a pool of unique card combos via Fisher-Yates shuffle.
  const allCombos: Array<{ value: Value; suit: Suit }> = [];
  for (const value of VALUES) {
    for (const suit of SUITS) {
      allCombos.push({ value, suit });
    }
  }
  for (let i = allCombos.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = allCombos[i]!;
    allCombos[i] = allCombos[j]!;
    allCombos[j] = tmp;
  }

  const pool = allCombos.slice(0, cardCount);
  const originalCards: Card[] = pool.map((combo, idx) => ({
    id: `card-${idx}` as CardId,
    label: `${combo.value}${combo.suit}`,
  }));

  // Apply changeCount changes, tracking which cards are affected.
  const modifiedCards: Card[] = originalCards.map(c => ({ ...c }));
  const appliedChanges: AppliedChange[] = [];
  const usedIndices = new Set<number>();

  // Change type pools per count (swap needs ≥2 unused cards).
  const singleTypePool: ChangeType[] = ['alter', 'rotate', 'remove'];
  const multiTypePool: ChangeType[] = ['swap', 'alter', 'rotate', 'remove'];

  for (let c = 0; c < changeCount; c++) {
    const available = Array.from({ length: cardCount }, (_, i) => i).filter(i => !usedIndices.has(i));
    if (available.length === 0) break;

    // For a single change, prefer non-swap types to keep the answer clear.
    const typePool = changeCount === 1 ? singleTypePool : multiTypePool;
    const type = typePool[rng.int(0, typePool.length - 1)] as ChangeType;

    if (type === 'swap' && available.length >= 2) {
      const pickA = available[rng.int(0, available.length - 1)] as number;
      const restAvail = available.filter(i => i !== pickA);
      const pickB = restAvail[rng.int(0, restAvail.length - 1)] as number;
      const labelA = modifiedCards[pickA]!.label;
      const labelB = modifiedCards[pickB]!.label;
      modifiedCards[pickA] = { ...modifiedCards[pickA]!, label: labelB };
      modifiedCards[pickB] = { ...modifiedCards[pickB]!, label: labelA };
      const cardIdA = `card-${pickA}` as CardId;
      const cardIdB = `card-${pickB}` as CardId;
      appliedChanges.push({ type: 'swap', cardIds: [cardIdA, cardIdB] });
      usedIndices.add(pickA);
      usedIndices.add(pickB);
    } else if (type === 'alter' || (type === 'swap' && available.length < 2)) {
      // Fall back to alter if swap is not possible.
      const pick = available[rng.int(0, available.length - 1)] as number;
      const originalSuit = pool[pick]!.suit;
      const originalValue = pool[pick]!.value;
      const newSuit = alterSuit(originalSuit, rng);
      modifiedCards[pick] = { ...modifiedCards[pick]!, label: `${originalValue}${newSuit}` };
      const cardId = `card-${pick}` as CardId;
      appliedChanges.push({ type: 'alter', cardIds: [cardId] });
      usedIndices.add(pick);
    } else if (type === 'rotate') {
      const pick = available[rng.int(0, available.length - 1)] as number;
      modifiedCards[pick] = { ...modifiedCards[pick]!, label: `${modifiedCards[pick]!.label}↺` };
      const cardId = `card-${pick}` as CardId;
      appliedChanges.push({ type: 'rotate', cardIds: [cardId] });
      usedIndices.add(pick);
    } else {
      // remove: show card as visually empty in the modified spread.
      const pick = available[rng.int(0, available.length - 1)] as number;
      modifiedCards[pick] = { ...modifiedCards[pick]!, label: '——' };
      const cardId = `card-${pick}` as CardId;
      appliedChanges.push({ type: 'remove', cardIds: [cardId] });
      usedIndices.add(pick);
    }
  }

  const changedCardIds = appliedChanges.flatMap(ch => ch.cardIds);

  return {
    originalCards,
    modifiedCards,
    changes: appliedChanges,
    changedCardIds,
    changeCount,
    studySeconds,
  };
}
