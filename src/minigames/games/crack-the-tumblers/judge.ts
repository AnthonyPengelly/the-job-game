import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';
import type { CrackTheTumblersParams } from './generate';

export interface CrackTheTumblersState {
  /** Cards tapped (recorded by GM) in the order they were played. */
  playedSequence: CardId[];
  /** True when a clash (out-of-order play) was detected and not undone by Reset Pin. */
  alarmTripped: boolean;
  /** Tech boost has been fired. */
  resetPinUsed: boolean;
}

/**
 * Crack the Tumblers is App-assist judged (MINIGAMES.md §5):
 *   clean        — all cards played in ascending order, no clash
 *   complication — completed but Reset Pin was used (one clash recovered)
 *   botched      — a clash tripped the alarm (or sequence incomplete)
 */
export function judge(state: CrackTheTumblersState, params: CrackTheTumblersParams): Outcome {
  if (state.alarmTripped) return 'botched';
  if (state.playedSequence.length < params.cards.length) return 'botched';
  return state.resetPinUsed ? 'complication' : 'clean';
}

/** Tech boost: Reset Pin — undo one misplay without tripping the alarm. */
export const resetPinBoost: BoostHook<CrackTheTumblersState, CrackTheTumblersParams> = {
  lane: 'tech',
  label: 'Reset Pin',
  apply(state): CrackTheTumblersState {
    if (state.resetPinUsed) return state;
    return {
      ...state,
      playedSequence: state.playedSequence.slice(0, -1),
      alarmTripped: false,
      resetPinUsed: true,
    };
  },
};
