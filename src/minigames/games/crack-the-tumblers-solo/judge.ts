import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';
import type { CrackTheTumblersSoloParams } from './generate';

export interface CrackTheTumblersSoloState {
  /** 'study' — sequence shown face-up; 'recall' — player taps from memory. */
  phase: 'study' | 'recall';
  /** Cards tapped during the recall phase in the order tapped. */
  recallSequence: CardId[];
  /** True when the player tapped a wrong card during recall (alarm = sequence broken). */
  alarmTripped: boolean;
  /** Tech boost flag — Reset Pin used (undoes one wrong tap). */
  resetPinUsed: boolean;
}

/**
 * Crack the Tumblers Solo is App-assist judged (MINIGAMES.md §5):
 *   clean        — recalled full sequence correctly, no alarm
 *   complication — Reset Pin used (one wrong tap recovered)
 *   botched      — alarm tripped (wrong tap not undone) or sequence incomplete
 */
export function judge(state: CrackTheTumblersSoloState, params: CrackTheTumblersSoloParams): Outcome {
  if (state.alarmTripped) return 'botched';
  if (state.recallSequence.length < params.correctOrder.length) return 'botched';
  return state.resetPinUsed ? 'complication' : 'clean';
}

/** Tech boost: Reset Pin — undo one wrong tap during recall without tripping the alarm. */
export const resetPinBoost: BoostHook<CrackTheTumblersSoloState, CrackTheTumblersSoloParams> = {
  lane: 'tech',
  label: 'Reset Pin',
  apply(state): CrackTheTumblersSoloState {
    if (state.resetPinUsed) return state;
    return {
      ...state,
      recallSequence: state.recallSequence.slice(0, -1),
      alarmTripped: false,
      resetPinUsed: true,
    };
  },
};
