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
  /** Stealth boost (Steady Breath) used flag. */
  steadyBreathUsed: boolean;
  /** True when Steady Breath absorbed a wobble. */
  wobbleForgiven: boolean;
}

/**
 * Suggest an outcome for Steady Hands (GM-judged — MINIGAMES.md §5).
 * The app tracks the timer and boost events; the tower is physical.
 *
 *   clean        — GM confirms tower reached target and is standing
 *   complication — a wobble survived / just short but standing
 *   botched      — toppled / well short / timed out
 *
 * Timer expiry suggests botched. Steady Breath use suggests complication.
 * All cases are GM-overridable via OutcomeJudge.
 */
export function judge(state: SteadyHandsState): Outcome {
  if (state.timerExpired) return 'botched';
  if (state.wobbleForgiven) return 'complication';
  return 'complication';
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

/** Stealth boost: Steady Breath — one wobble forgiven. */
export const steadyBreathBoost: BoostHook<SteadyHandsState, SteadyHandsParams> = {
  lane: 'stealth',
  label: 'Steady Breath',
  apply(state): SteadyHandsState {
    if (state.steadyBreathUsed) return state;
    return { ...state, steadyBreathUsed: true, wobbleForgiven: true };
  },
};
