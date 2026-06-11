import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { OnceOverParams } from './generate';

export interface OnceOverState {
  /** Crew callouts the GM marked as correct (a changed position spotted). */
  hits: number;
  /** Crew callouts the GM marked as wrong. */
  misses: number;
  /** True once the study timer expires (GM hides the row and applies changes). */
  studyTimerExpired: boolean;
  /** True after the Hunch (Stealth) boost fires. */
  stealthBoostUsed: boolean;
  /** True when the GM has issued a hunch clue (set by boost). */
  hunchActive: boolean;
}

/**
 * Suggest an outcome for The Once-Over (GM-recorded, MINIGAMES.md §5):
 *   clean        — every change event spotted
 *   complication — some but not all changes spotted
 *   botched      — nothing correctly spotted
 *
 * The GM marks each crew callout hit/miss against the instruction list; the
 * GM confirms via OutcomeJudge and can override (e.g. "at the buzzer").
 */
export function judge(state: OnceOverState, params: OnceOverParams): Outcome {
  if (state.hits === 0) return 'botched';
  if (state.hits >= params.changeCount) return 'clean';
  return 'complication';
}

/** Stealth boost: Hunch — GM delivers a live verbal clue. Pure apply, once per game. */
export const hunchBoost: BoostHook<OnceOverState, OnceOverParams> = {
  lane: 'stealth',
  label: 'Hunch',
  apply(state): OnceOverState {
    if (state.stealthBoostUsed) return state;
    return { ...state, stealthBoostUsed: true, hunchActive: true };
  },
};
