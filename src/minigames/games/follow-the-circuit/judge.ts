import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';
import type { FollowTheCircuitParams } from './generate';

export interface FollowTheCircuitState {
  /** Highest sequence length successfully completed (0 = nothing completed yet). */
  lengthReached: number;
  /** True once an unforgivable mis-tap breaks the chain. */
  chainBroke: boolean;
  /** Tech boost (Photographic — replay sequence) used. */
  photographicUsed: boolean;
  /** Taps recorded in the current input round, reset each round. */
  tapsThisRound: CardId[];
}

/**
 * Follow the Circuit is App-assist judged (MINIGAMES.md §5):
 *   clean        — reached the target length
 *   complication — one short of target
 *   botched      — broke early (more than one short)
 */
export function judge(
  state: FollowTheCircuitState,
  params: FollowTheCircuitParams,
): Outcome {
  if (state.lengthReached >= params.targetLength) return 'clean';
  if (state.chainBroke) {
    return state.lengthReached >= params.targetLength - 1 ? 'complication' : 'botched';
  }
  return 'botched';
}

/**
 * Tech boost: Photographic — replay the current sequence once.
 * Sets photographicUsed; the component reacts by restarting playback.
 */
export const photographicBoost: BoostHook<FollowTheCircuitState, FollowTheCircuitParams> = {
  lane: 'tech',
  label: 'Photographic',
  apply(state): FollowTheCircuitState {
    if (state.photographicUsed) return state;
    return {
      ...state,
      photographicUsed: true,
      tapsThisRound: [],
    };
  },
};
