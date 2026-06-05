import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';
import type { FollowTheCircuitParams } from './generate';

export interface FollowTheCircuitState {
  /** Highest sequence length successfully completed (0 = nothing completed yet). */
  lengthReached: number;
  /** True once an unforgivable mis-tap breaks the chain. */
  chainBroke: boolean;
  /** True if Muscle Memory forgave a fumble (caps outcome at complication). */
  fumbleForgiven: boolean;
  /** Tech boost (Photographic — replay sequence) used. */
  photographicUsed: boolean;
  /** Physical boost (Muscle Memory — slow + forgive one fumble) used. */
  muscleMemoryUsed: boolean;
  /** Taps recorded in the current input round, reset each round. */
  tapsThisRound: CardId[];
}

/**
 * Follow the Circuit is App-assist judged (MINIGAMES.md §5):
 *   clean        — reached the target length (with no forgiven fumble)
 *   complication — one short of target, or reached it via Muscle Memory forgiveness
 *   botched      — broke early (more than one short)
 */
export function judge(
  state: FollowTheCircuitState,
  params: FollowTheCircuitParams,
): Outcome {
  if (state.lengthReached >= params.targetLength) {
    // Completed — a forgiven fumble caps the result at complication
    return state.fumbleForgiven ? 'complication' : 'clean';
  }
  if (state.chainBroke) {
    // Chain broke — one short is complication; earlier is botched
    return state.lengthReached >= params.targetLength - 1 ? 'complication' : 'botched';
  }
  // Game still in progress
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
      // Reset taps so the replay can be cleanly re-entered
      tapsThisRound: [],
    };
  },
};

/**
 * Physical boost: Muscle Memory — slower playback and one fumble forgiven.
 * Sets muscleMemoryUsed; the component slows playback and absorbs one wrong tap.
 */
export const muscleMemoryBoost: BoostHook<FollowTheCircuitState, FollowTheCircuitParams> = {
  lane: 'physical',
  label: 'Muscle Memory',
  apply(state): FollowTheCircuitState {
    if (state.muscleMemoryUsed) return state;
    return { ...state, muscleMemoryUsed: true };
  },
};
