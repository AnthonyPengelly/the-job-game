import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { AssemblyLineNegotiatedParams } from './generate';

export interface AssemblyLineNegotiatedState {
  timerExpired: boolean;
  /** GM-tapped count of players who have completed their set. */
  setsCompleted: number;
  /** Total sets needed — initialised from committed.length in the component. */
  targetSets: number;
  /** Charm boost (Tip-Off) used flag. */
  tipOffUsed: boolean;
}

/**
 * Suggest an outcome for Assembly Line Negotiated (GM-watched — MINIGAMES.md §5).
 *
 *   clean        — everyone has a complete set with time to spare
 *   complication — completed at the buzzer / all-but-one
 *   botched      — not solved when the timer ran out
 */
export function judge(state: AssemblyLineNegotiatedState): Outcome {
  if (state.timerExpired) {
    if (state.setsCompleted >= state.targetSets) return 'complication';
    return 'botched';
  }
  if (state.setsCompleted >= state.targetSets) return 'clean';
  if (state.targetSets > 1 && state.setsCompleted >= state.targetSets - 1) return 'complication';
  return 'complication';
}

/** Charm boost: Tip-Off — reveal which set-types are in play, once per game. */
export const tipOffBoost: BoostHook<AssemblyLineNegotiatedState, AssemblyLineNegotiatedParams> = {
  lane: 'charm',
  label: 'Tip-Off',
  apply(state): AssemblyLineNegotiatedState {
    if (state.tipOffUsed) return state;
    return { ...state, tipOffUsed: true };
  },
};
