import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { AssemblyLineParams } from './generate';

export interface AssemblyLineState {
  timerExpired: boolean;
  /** GM-tapped count of players who have completed their set. */
  setsCompleted: number;
  /** Total sets needed — initialised from committed.length in the component. */
  targetSets: number;
  /** Charm boost (Tip-Off) used flag. */
  tipOffUsed: boolean;
}

/**
 * Suggest an outcome for Assembly Line (GM-watched — MINIGAMES.md §5).
 *
 *   clean        — everyone has a complete set (regardless of whether timer also expired)
 *   complication — all-but-one complete, or game in progress
 *   botched      — timer ran out without all sets completed
 */
export function judge(state: AssemblyLineState): Outcome {
  if (state.setsCompleted >= state.targetSets) return 'clean';
  if (state.timerExpired) return 'botched';
  if (state.targetSets > 1 && state.setsCompleted >= state.targetSets - 1) return 'complication';
  return 'complication';
}

/** Charm boost: Tip-Off — reveal which set-types are in play, once per game. */
export const tipOffBoost: BoostHook<AssemblyLineState, AssemblyLineParams> = {
  lane: 'charm',
  label: 'Tip-Off',
  apply(state): AssemblyLineState {
    if (state.tipOffUsed) return state;
    return { ...state, tipOffUsed: true };
  },
};
