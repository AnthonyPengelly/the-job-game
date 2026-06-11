import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { SteadyHandsParams } from './generate';

export interface SteadyHandsState {
  /** True once the main timer expires. */
  timerExpired: boolean;
  /** Physical boost (Extra Hands) used flag. */
  extraHandsUsed: boolean;
  /** True while the 10s all-hands window is active. */
  extraHandsActive: boolean;
  /** GM-tracked current height (tapped up/down as the crew builds). */
  currentHeight: number;
}

/**
 * Suggest an outcome for Steady Hands (GM-judged — MINIGAMES.md §5).
 * The app tracks the timer and the GM-tapped height; the tower is physical,
 * so a topple is the GM's call (override via OutcomeJudge).
 *
 *   clean        — height tally reached the target
 *   complication — one tier short at the buzzer, or still building
 *   botched      — timed out two or more tiers short
 */
export function judge(state: SteadyHandsState, params: SteadyHandsParams): Outcome {
  if (state.currentHeight >= params.targetHeight) return 'clean';
  if (!state.timerExpired) return 'complication';
  return state.currentHeight === params.targetHeight - 1 ? 'complication' : 'botched';
}

/** Physical boost: Extra Hands — 10s where everyone (benched included) can help build. */
export const extraHandsBoost: BoostHook<SteadyHandsState, SteadyHandsParams> = {
  lane: 'physical',
  label: 'Extra Hands',
  apply(state): SteadyHandsState {
    if (state.extraHandsUsed) return state;
    return { ...state, extraHandsUsed: true, extraHandsActive: true };
  },
};
