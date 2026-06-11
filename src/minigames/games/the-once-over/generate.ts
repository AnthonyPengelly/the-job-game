import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export type ChangeType = 'swap' | 'replace';

export interface PositionChange {
  type: ChangeType;
  /**
   * 1-based positions in the dealt row, counted from the GM's left.
   * swap → exactly two positions; replace → exactly one.
   */
  positions: number[];
}

export interface OnceOverParams {
  /** How many random cards the GM deals face-up in a row. */
  cardCount: number;
  /** Positional change instructions the GM applies while the row is hidden. */
  changes: PositionChange[];
  /** Flat list of every changed position (convenience for display/judging). */
  changedPositions: number[];
  /** Number of change events applied. */
  changeCount: number;
  /** Study timer duration in seconds. */
  studySeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate The Once-Over parameters from the seeded RNG and the resolved dial.
 *
 * The cards are physical and random — the GM deals any `cardCount` cards
 * face-up in a row, the crew studies them, then the GM hides the row and
 * applies the generated *positional* instructions (swap two positions, or
 * replace a position with the top card of the deck). Positions, not card
 * names, so the instructions work with whatever was dealt and setup needs no
 * card-hunting. Swap and replace are the two change types that survive a
 * random deal: they keep the row length stable and leave no visual tell.
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

  // Shuffle positions 1..cardCount; changes consume from the front so no
  // position is touched twice (instructions stay order-independent).
  const positions = Array.from({ length: cardCount }, (_, i) => i + 1);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = positions[i]!;
    positions[i] = positions[j]!;
    positions[j] = tmp;
  }

  const changes: PositionChange[] = [];
  let cursor = 0;
  for (let c = 0; c < changeCount; c++) {
    const remaining = cardCount - cursor;
    if (remaining < 1) break;
    const wantSwap = remaining >= 2 && rng.int(0, 1) === 1;
    if (wantSwap) {
      changes.push({ type: 'swap', positions: [positions[cursor]!, positions[cursor + 1]!] });
      cursor += 2;
    } else {
      changes.push({ type: 'replace', positions: [positions[cursor]!] });
      cursor += 1;
    }
  }

  const changedPositions = changes.flatMap(ch => ch.positions).sort((a, b) => a - b);

  return {
    cardCount,
    changes,
    changedPositions,
    changeCount: changes.length,
    studySeconds,
  };
}
