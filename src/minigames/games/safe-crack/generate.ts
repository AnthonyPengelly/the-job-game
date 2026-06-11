import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export interface SafeCrackParams {
  /** The hidden combination the crew must crack. */
  code: number[];
  /** Lowest digit in the pool (inclusive). The GM states the pool out loud. */
  digitMin: number;
  /** Highest digit in the pool (inclusive). Duplicates allowed. */
  digitMax: number;
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
 *   - guessBudget: more guesses at lower difficulty (digits+2..8)
 *   - timerSeconds: more time at lower difficulty (75..180)
 *
 * The digit pool is small (playtest wave 2): 1–4 for 3-digit codes, 1–5 for
 * 4-digit, duplicates allowed. Drawing 0–9 made the game harder than
 * Mastermind — too slow to deduce under a live clock with limited tries.
 * 4^3 = 64 / 5^4 = 625 candidate codes keeps deduction fast and fun.
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
  const digitMin = 1;
  const digitMax = digitCount === 3 ? 4 : 5;
  // Budget shrinks with the pool (max 8, was 10) but never below digits + 2 —
  // the winnability floor from MINIGAMES.md §6.7.
  const guessBudget = clamp(Math.round(7 - dial.level), digitCount + 2, 8);
  const timerSeconds = clamp(Math.round(150 - dial.level * 25), 75, 180);

  const code: number[] = [];
  for (let i = 0; i < digitCount; i++) {
    code.push(rng.int(digitMin, digitMax));
  }

  return { code, digitMin, digitMax, guessBudget, timerSeconds };
}
