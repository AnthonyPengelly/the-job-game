import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { CrackTheTumblersSoloParams } from './generate';

export interface CrackTheTumblersSoloState {
  /** 'setup' — GM dealing; 'study' — row face-up under the clock; 'recall' — flipping from memory. */
  phase: 'setup' | 'study' | 'recall';
  /** Flips the GM has recorded as in ascending order. */
  flipsRecorded: number;
  /** True when a revealed card came up lower than the previous one (alarm) and was not forgiven. */
  alarmTripped: boolean;
  /** Tech boost flag — Reset Pin used (one wrong flip turned back over). */
  resetPinUsed: boolean;
}

/**
 * Crack the Tumblers Solo is GM-recorded (MINIGAMES.md §5): the cards are
 * physical; each reveal is public and the GM taps in-order / clash.
 *
 *   clean        — full row flipped in ascending order, no alarm
 *   complication — Reset Pin used (one wrong flip turned back over)
 *   botched      — alarm tripped (wrong flip not undone) or row incomplete
 */
export function judge(state: CrackTheTumblersSoloState, params: CrackTheTumblersSoloParams): Outcome {
  if (state.alarmTripped) return 'botched';
  if (state.flipsRecorded < params.cardCount) return 'botched';
  return state.resetPinUsed ? 'complication' : 'clean';
}

/**
 * Tech boost: Reset Pin — forgive one wrong flip. The card is turned back
 * face-down where it lies; the recorded count is unchanged because the wrong
 * flip was never counted.
 */
export const resetPinBoost: BoostHook<CrackTheTumblersSoloState, CrackTheTumblersSoloParams> = {
  lane: 'tech',
  label: 'Reset Pin',
  apply(state): CrackTheTumblersSoloState {
    if (state.resetPinUsed) return state;
    return {
      ...state,
      alarmTripped: false,
      resetPinUsed: true,
    };
  },
};
