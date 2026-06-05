import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { AssemblyLineParams } from './generate';

export interface AssemblyLineState {
  timerExpired: boolean;
  /** GM-tapped count of players who have completed their set. */
  setsCompleted: number;
  /** Total sets needed — initialised from committed.length in the component. */
  targetSets: number;
  /** Physical boost (Quick Hands) used flag. */
  quickHandsUsed: boolean;
  /** Charm boost (Tip-Off) used flag. */
  tipOffUsed: boolean;
}

/**
 * Suggest an outcome for Assembly Line (GM-watched — MINIGAMES.md §5).
 *
 *   clean        — everyone has a complete set with time to spare
 *   complication — completed at the buzzer / all-but-one still standing
 *   botched      — not solved when the timer ran out
 */
export function judge(state: AssemblyLineState): Outcome {
  if (state.timerExpired) {
    if (state.setsCompleted >= state.targetSets) return 'complication'; // all done but at buzzer
    return 'botched';
  }
  if (state.setsCompleted >= state.targetSets) return 'clean';
  if (state.targetSets > 1 && state.setsCompleted >= state.targetSets - 1) return 'complication';
  return 'complication';
}

/** Physical boost: Quick Hands — one 2-for-1 trade, once per game. */
export const quickHandsBoost: BoostHook<AssemblyLineState, AssemblyLineParams> = {
  lane: 'physical',
  label: 'Quick Hands',
  apply(state): AssemblyLineState {
    if (state.quickHandsUsed) return state;
    return { ...state, quickHandsUsed: true };
  },
};

/** Charm boost: Tip-Off — reveal which set-types are in play, once per game. */
export const tipOffBoost: BoostHook<AssemblyLineState, AssemblyLineParams> = {
  lane: 'charm',
  label: 'Tip-Off',
  apply(state): AssemblyLineState {
    if (state.tipOffUsed) return state;
    return { ...state, tipOffUsed: true };
  },
};
