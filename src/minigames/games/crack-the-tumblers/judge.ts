import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { CrackTheTumblersParams } from './generate';

export interface CrackTheTumblersState {
  /** Total cards dealt (committed players × cardsPerPlayer) — set by the component at start. */
  totalCards: number;
  /** Cards the GM has recorded as played in order. */
  playsRecorded: number;
  /** True when the GM recorded a clash (a card played out of ascending order) not yet forgiven. */
  alarmTripped: boolean;
  /** Tech boost has been fired. */
  resetPinUsed: boolean;
}

/**
 * Crack the Tumblers is GM-recorded (MINIGAMES.md §5): the cards are physical
 * and the GM taps in-order / clash as the crew plays.
 *
 *   clean        — every card recorded in order, no clash
 *   complication — completed but Reset Pin was used (one clash recovered)
 *   botched      — a clash tripped the alarm, or the sequence was incomplete
 */
export function judge(state: CrackTheTumblersState): Outcome {
  if (state.alarmTripped) return 'botched';
  if (state.playsRecorded < state.totalCards) return 'botched';
  return state.resetPinUsed ? 'complication' : 'clean';
}

/**
 * Tech boost: Reset Pin — forgive one clash. The misplayed card goes back to
 * its holder's hand at the table; the recorded count is unchanged because the
 * clash was never counted as an in-order play.
 */
export const resetPinBoost: BoostHook<CrackTheTumblersState, CrackTheTumblersParams> = {
  lane: 'tech',
  label: 'Reset Pin',
  apply(state): CrackTheTumblersState {
    if (state.resetPinUsed) return state;
    return {
      ...state,
      alarmTripped: false,
      resetPinUsed: true,
    };
  },
};
