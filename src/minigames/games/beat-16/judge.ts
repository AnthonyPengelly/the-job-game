import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { Beat16Params } from './generate';

export interface Beat16State {
  /** Epoch-ms when the player tapped the beat button. Null if no tap yet. */
  tapTimestampMs: number | null;
  /**
   * Signed timing error: tapTime − expectedTargetBeatTime (ms).
   * Null if the player has not yet tapped.
   */
  measuredDeltaMs: number | null;
  /** Physical boost has been fired. */
  boostUsed: boolean;
}

/**
 * Beat 16 is App-assist judged (MINIGAMES.md §5):
 *   clean        — |delta| within the tight window
 *   complication — |delta| within the wider window (off but close)
 *   botched      — no tap, or |delta| outside the wider window
 */
export function judge(state: Beat16State, params: Beat16Params): Outcome {
  if (state.measuredDeltaMs === null) return 'botched';
  const absDelta = Math.abs(state.measuredDeltaMs);
  if (absDelta <= params.cleanWindowMs) return 'clean';
  if (absDelta <= params.complicationWindowMs) return 'complication';
  return 'botched';
}

/** Physical boost: In the Bones — two extra audible beats before the mute, once per game. */
export const inTheBonesBoost: BoostHook<Beat16State, Beat16Params> = {
  lane: 'physical',
  label: 'In the Bones',
  apply(state): Beat16State {
    if (state.boostUsed) return state;
    return {
      ...state,
      boostUsed: true,
    };
  },
};
