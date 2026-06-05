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
  /** Stealth boost (Spare Wire) used flag — forgives one wrong cut. */
  spareWireUsed: boolean;
}

/**
 * Suggest an outcome for Defuse the Alarm (app fully judges — MINIGAMES.md §5):
 *   clean        — all safe cuts made, no wrong cut, timer still running
 *   complication — completed at the buzzer (timerExpired) or with a forgiven wrong cut (spareWireUsed)
 *   botched      — un-forgiven wrong cut trips the alarm / timer expired before all safe cuts done
 */
export function judge(state: DefuseState, params: DefuseParams): Outcome {
  const wrongCuts = state.cutIds.filter(id => !params.safeWireIds.includes(id));
  const hasWrongCut = wrongCuts.length > 0;
  const allSafeCut =
    params.safeWireIds.length > 0 &&
    params.safeWireIds.every(id => state.cutIds.includes(id));

  // Alarm tripped — spareWire forgives exactly one wrong cut, not all
  if (wrongCuts.length > (state.spareWireUsed ? 1 : 0)) return 'botched';

  // Timer expired without completing all safe cuts
  if (state.timerExpired && !allSafeCut) return 'botched';

  if (allSafeCut) {
    // Completed with a forgiven wrong cut or at the buzzer → complication
    if (hasWrongCut || state.timerExpired) return 'complication';
    return 'clean';
  }

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

/** Stealth boost: Spare Wire — forgive one wrong cut, once per game. */
export const spareWireBoost: BoostHook<DefuseState, DefuseParams> = {
  lane: 'stealth',
  label: 'Spare Wire',
  apply(state): DefuseState {
    if (state.spareWireUsed) return state;
    return { ...state, spareWireUsed: true };
  },
};
