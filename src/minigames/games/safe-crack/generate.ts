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
 *   - digitCount: 3 digits normally, 4 only at high difficulty
 *   - guessBudget: more guesses at lower difficulty (6..10)
 *   - timerSeconds: more time at lower difficulty (75..180)
 *
 * The code is kept deliberately small: digit count and guess budget must never
 * scale against the player at the same time. A 6-digit code in 3 guesses (the
 * old high-dial output) is information-theoretically unwinnable — the dial
 * squeezes guesses and time instead, which keeps the game hard but fair.
 *
 * Both lanes (Tech + Stealth) aggregate into dial.level via computeDial before
 * generate is called. The scalar drives all three levers together — per-lane
 * differentiation (Tech → digit count, Stealth → guess count) is not implemented;
 * the scalar aggregation is the accepted E4 trade-off (see MINIGAMES.md §3).
 */
export function generate(rng: Rng, dial: Difficulty): SafeCrackParams {
  const digitCount = clamp(Math.round(3 + dial.level * 0.5), 3, 4);
  const guessBudget = clamp(Math.round(8 - dial.level), 6, 10);
  const timerSeconds = clamp(Math.round(150 - dial.level * 25), 75, 180);

  const code: number[] = [];
  for (let i = 0; i < digitCount; i++) {
    code.push(rng.int(0, 9));
  }

  return { code, guessBudget, timerSeconds };
}
