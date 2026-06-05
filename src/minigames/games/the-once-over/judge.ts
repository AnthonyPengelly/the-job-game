import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';
import type { OnceOverParams } from './generate';

export interface OnceOverState {
  /** Card IDs the crew flagged as changed. */
  flaggedCardIds: CardId[];
  /** True once the study timer expires (modified spread is revealed). */
  studyTimerExpired: boolean;
  /** True after the Hunch (Stealth) boost fires. */
  stealthBoostUsed: boolean;
  /** True when the GM has issued a hunch clue (set by boost). */
  hunchActive: boolean;
}

/**
 * Suggest an outcome for The Once-Over (App-assist, MINIGAMES.md §5):
 *   clean        — all changed card(s) correctly flagged
 *   complication — correct card flagged but one of several (partial hit)
 *   botched      — no card flagged, or only wrong cards flagged
 *
 * The GM confirms via OutcomeJudge and can override (e.g. "at the buzzer").
 */
export function judge(state: OnceOverState, params: OnceOverParams): Outcome {
  if (state.flaggedCardIds.length === 0) return 'botched';

  const changedSet = new Set<CardId>(params.changedCardIds);
  const correctFlags = state.flaggedCardIds.filter(id => changedSet.has(id));

  if (correctFlags.length === 0) return 'botched';

  // All changes identified.
  if (correctFlags.length >= params.changedCardIds.length) return 'clean';

  // Some changes identified (one of several).
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
