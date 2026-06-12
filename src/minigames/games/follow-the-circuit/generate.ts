import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import type { Card, CardId } from '@/minigames/primitives/CardSpread';

export interface FollowTheCircuitParams {
  /** Grid of circuit-node cards the sequence draws from (fixed 6-card set). */
  cards: Card[];
  /** Full RNG-generated sequence to reproduce, indexed 0..targetLength-1. */
  sequence: CardId[];
  /** Number of sequence steps the crew must reach to clear the circuit. */
  targetLength: number;
  /** Milliseconds per card during playback (lower = faster = harder). */
  playbackSpeedMs: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Follow the Circuit parameters from the seeded RNG and resolved dial.
 *
 * Playtest wave 3: six pads and longer sequences — ~10 at a medium dial,
 * 16 at the hard end — because the 4-pad/short-sequence version "took a
 * while to get interesting". Runs of 3+ identical pads are re-drawn: a
 * 5×same-pad opening is statistically legal (~1/256 with 4 pads) but reads
 * as a bug at the table.
 *
 * Dial levers (lower dial.level = easier):
 *   - targetLength: shorter sequence at lower difficulty (7..16)
 *   - playbackSpeedMs: slower playback at lower difficulty (1400..500 ms/card)
 *
 * Tech + Physical lanes aggregate into dial.level via computeDial before this is called.
 * The 6-card grid is fixed; only the sequence and timing vary.
 */
export function generate(rng: Rng, dial: Difficulty): FollowTheCircuitParams {
  const targetLength = clamp(Math.round(10 + dial.level * 3), 7, 16);
  const playbackSpeedMs = clamp(Math.round(1000 - dial.level * 150), 500, 1400);

  // Fixed 6-card circuit grid — the nodes the crew must follow in order.
  const cards: Card[] = [
    { id: 'node-A' as CardId, label: 'A' },
    { id: 'node-B' as CardId, label: 'B' },
    { id: 'node-C' as CardId, label: 'C' },
    { id: 'node-D' as CardId, label: 'D' },
    { id: 'node-E' as CardId, label: 'E' },
    { id: 'node-F' as CardId, label: 'F' },
  ];

  const sequence: CardId[] = [];
  while (sequence.length < targetLength) {
    const candidate = rng.pick(cards).id;
    const n = sequence.length;
    // Never three identical pads in a row.
    if (n >= 2 && sequence[n - 1] === candidate && sequence[n - 2] === candidate) continue;
    sequence.push(candidate);
  }

  return { cards, sequence, targetLength, playbackSpeedMs };
}
