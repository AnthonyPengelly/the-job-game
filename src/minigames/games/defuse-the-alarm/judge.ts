import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';
import type { DefuseParams } from './generate';

export interface DefuseState {
  /** Ids of wires that have been cut so far (entered by the GM as the crew makes cuts). */
  cutIds: CardId[];
  /** True once the countdown timer expires. */
  timerExpired: boolean;
  /** Charm boost (Clear Channel) used flag — one full sentence allowed. */
  clearChannelUsed: boolean;
}

/**
 * Suggest an outcome for Defuse the Alarm (app fully judges — MINIGAMES.md §5):
 *   clean        — all safe cuts made, no wrong cut (regardless of whether timer also expired)
 *   complication — game still in progress (no wrong cut yet, not all safe cuts done)
 *   botched      — a wrong cut trips the alarm, or timer expired before all safe cuts done
 */
export function judge(state: DefuseState, params: DefuseParams): Outcome {
  const hasWrongCut = state.cutIds.some(id => !params.safeWireIds.includes(id));
  const allSafeCut =
    params.safeWireIds.length > 0 &&
    params.safeWireIds.every(id => state.cutIds.includes(id));

  // Any wrong cut trips the alarm
  if (hasWrongCut) return 'botched';

  // All safe cuts done — clean regardless of timer
  if (allSafeCut) return 'clean';

  // Timer expired without completing all safe cuts
  if (state.timerExpired) return 'botched';

  // Game still in progress — middle-ground suggestion
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
