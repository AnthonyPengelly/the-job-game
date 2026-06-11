import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { DefuseParams } from './generate';

export interface DefuseState {
  /** Cuts the GM has recorded as matching a rule. */
  safeCuts: number;
  /** True when the GM recorded a cut that matched no rule — the alarm. */
  wrongCut: boolean;
  /** True when the GM declared every matching wire cut (verified against the row). */
  allClear: boolean;
  /** True once the countdown timer expires. */
  timerExpired: boolean;
  /** Charm boost (Clear Channel) used flag — one full sentence allowed. */
  clearChannelUsed: boolean;
}

/**
 * Suggest an outcome for Defuse the Alarm (GM-recorded — MINIGAMES.md §5).
 * The cards are physical and random, so the GM is the sensor: they can see
 * both the dealt row and the rules, and record each cut.
 *
 *   clean        — GM declared all-clear with no wrong cut (regardless of timer)
 *   complication — still defusing (no wrong cut, not yet all-clear)
 *   botched      — a wrong cut tripped the alarm, or time ran out first
 */
export function judge(state: DefuseState): Outcome {
  if (state.wrongCut) return 'botched';
  if (state.allClear) return 'clean';
  if (state.timerExpired) return 'botched';
  return 'complication';
}

/** Charm boost: Clear Channel — one full sentence allowed, once per game. */
export const clearChannelBoost: BoostHook<DefuseState, DefuseParams> = {
  lane: 'charm',
  label: 'Clear Channel',
  apply(state): DefuseState {
    if (state.clearChannelUsed) return state;
    return { ...state, clearChannelUsed: true };
  },
};
