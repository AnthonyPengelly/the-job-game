import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { CategoriesParams } from './generate';

export interface CategoriesState {
  /** Running count of valid answers the GM has tapped. */
  tally: number;
  /** True once the countdown timer expires. */
  timerExpired: boolean;
  /** True after the Skip (Charm) boost fires. */
  charmBoostUsed: boolean;
  /** True if the Skip boost was used, indicating skipCategory is now active. */
  skipped: boolean;
}

/**
 * Suggest an outcome for Categories (GM-judged, MINIGAMES.md §5):
 *   clean        — tally met the target (regardless of whether the timer also expired)
 *   complication — tally fell short by one (scraped/late-but-short by a small margin)
 *   botched      — tally missed by more than one
 */
export function judge(state: CategoriesState, params: CategoriesParams): Outcome {
  if (state.tally >= params.targetCount) return 'clean';
  if (state.tally >= params.targetCount - 1) return 'complication';
  return 'botched';
}

/** Charm boost: Skip — swap to the alternate category once, resetting the tally. */
export const skipBoost: BoostHook<CategoriesState, CategoriesParams> = {
  lane: 'charm',
  label: 'Skip',
  apply(state): CategoriesState {
    if (state.charmBoostUsed) return state;
    return { ...state, charmBoostUsed: true, skipped: true, tally: 0 };
  },
};
