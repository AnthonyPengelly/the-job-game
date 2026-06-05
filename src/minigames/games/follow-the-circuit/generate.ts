import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import type { Card, CardId } from '@/minigames/primitives/CardSpread';

export interface FollowTheCircuitParams {
  /** Grid of circuit-node cards the sequence draws from (fixed 4-card set). */
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
 * Dial levers (lower dial.level = easier):
 *   - targetLength: shorter sequence at lower difficulty (3..8)
 *   - playbackSpeedMs: slower playback at lower difficulty (1600..500 ms/card)
 *
 * Tech + Physical lanes aggregate into dial.level via computeDial before this is called.
 * The 4-card grid is fixed; only the sequence and timing vary.
 */
export function generate(rng: Rng, dial: Difficulty): FollowTheCircuitParams {
  const targetLength = clamp(Math.round(5 + dial.level * 1.5), 3, 8);
  const playbackSpeedMs = clamp(Math.round(1100 - dial.level * 200), 500, 1600);

  // Fixed 4-card circuit grid — the nodes the crew must follow in order.
  const cards: Card[] = [
    { id: 'node-A' as CardId, label: 'A' },
    { id: 'node-B' as CardId, label: 'B' },
    { id: 'node-C' as CardId, label: 'C' },
    { id: 'node-D' as CardId, label: 'D' },
  ];

  const sequence: CardId[] = Array.from({ length: targetLength }, () => rng.pick(cards).id);

  return { cards, sequence, targetLength, playbackSpeedMs };
}
