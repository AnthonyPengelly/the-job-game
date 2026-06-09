import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { SafeCrackParams } from './generate';

export interface GuessResult {
  guess: number[];
  /** Correct digit in the correct position. */
  rightPlace: number;
  /** Correct digit in the wrong position. */
  rightDigit: number;
}

export interface SafeCrackState {
  guesses: GuessResult[];
  guessesRemaining: number;
  solved: boolean;
  techBoostUsed: boolean;
  /** Set by Stethoscope: reveals one unconfirmed digit's position to the GM. */
  stethoscopeReveal?: { position: number; digit: number };
}

/**
 * Compute Mastermind-style feedback for a guess against the hidden code.
 * rightPlace: digit value and position both correct.
 * rightDigit: digit value correct but wrong position.
 */
export function computeFeedback(code: number[], guess: number[]): { rightPlace: number; rightDigit: number } {
  let rightPlace = 0;
  const codeRem: number[] = [];
  const guessRem: number[] = [];

  for (let i = 0; i < code.length; i++) {
    if (code[i] === guess[i]) {
      rightPlace++;
    } else {
      codeRem.push(code[i] as number);
      guessRem.push(guess[i] as number);
    }
  }

  let rightDigit = 0;
  const codeRemCopy = [...codeRem];
  for (const g of guessRem) {
    const idx = codeRemCopy.indexOf(g);
    if (idx !== -1) {
      rightDigit++;
      codeRemCopy.splice(idx, 1);
    }
  }

  return { rightPlace, rightDigit };
}

/** Find the first position not yet confirmed correct, to reveal via Stethoscope. */
function findStethoscopeReveal(
  state: SafeCrackState,
  params: SafeCrackParams,
): { position: number; digit: number } {
  const confirmed = new Set<number>();
  for (const g of state.guesses) {
    g.guess.forEach((d, i) => {
      if (d === params.code[i]) confirmed.add(i);
    });
  }
  for (let i = 0; i < params.code.length; i++) {
    if (!confirmed.has(i)) return { position: i, digit: params.code[i] as number };
  }
  return { position: 0, digit: params.code[0] as number };
}

/**
 * Safe-Crack is fully app-judged (MINIGAMES.md §5):
 *   clean        — solved with guesses to spare (guessesRemaining > 0)
 *   complication — solved on the very last guess (guessesRemaining === 0)
 *   botched      — guesses exhausted without solving
 *
 * params is not needed for judging — outcome is based solely on state.
 */
export function judge(state: SafeCrackState): Outcome {
  if (!state.solved) return 'botched';
  if (state.guessesRemaining > 0) return 'clean';
  return 'complication';
}

/** Tech boost: Stethoscope — reveal a digit's position. Pure apply, once per game. */
export const techBoost: BoostHook<SafeCrackState, SafeCrackParams> = {
  lane: 'tech',
  label: 'Stethoscope',
  apply(state, params): SafeCrackState {
    if (state.techBoostUsed) return state;
    return { ...state, techBoostUsed: true, stethoscopeReveal: findStethoscopeReveal(state, params) };
  },
};
