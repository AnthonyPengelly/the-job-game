import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export interface SafeCrackParams {
  /** The hidden combination the crew must crack. */
  code: number[];
  /** Total guesses allowed at game start. */
  guessBudget: number;
  /** Countdown timer length in seconds. */
  timerSeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Safe-Crack parameters from the seeded RNG and the resolved dial.
 *
 * Dial levers (lower dial.level = easier):
 *   - digitCount: fewer digits at lower difficulty (3..6)
 *   - guessBudget: more guesses at lower difficulty (3..10)
 *   - timerSeconds: more time at lower difficulty (60..180)
 *
 * Both lanes (Tech + Stealth) aggregate into dial.level via computeDial before
 * generate is called. The scalar drives all three levers together — per-lane
 * differentiation (Tech → digit count, Stealth → guess count) is not implemented;
 * the scalar aggregation is the accepted E4 trade-off (see MINIGAMES.md §3).
 */
export function generate(rng: Rng, dial: Difficulty): SafeCrackParams {
  const digitCount = clamp(Math.round(4 + dial.level * 1.5), 3, 6);
  const guessBudget = clamp(Math.round(6 - dial.level * 1.5), 3, 10);
  const timerSeconds = clamp(Math.round(120 - dial.level * 30), 60, 180);

  const code: number[] = [];
  for (let i = 0; i < digitCount; i++) {
    code.push(rng.int(0, 9));
  }

  return { code, guessBudget, timerSeconds };
}
