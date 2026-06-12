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
  /**
   * Insulated Gloves boost (wave 3) fired — the NEXT wrong cut is absorbed
   * instead of tripping the alarm. Armed before or shouted right after the
   * mistake; either way it spends the once-per-game use.
   */
  glovesArmed: boolean;
  /** A wrong cut was absorbed by the gloves — caps the result at complication. */
  wrongCutForgiven: boolean;
}

/**
 * Suggest an outcome for Defuse the Alarm (GM-recorded — MINIGAMES.md §5).
 * The cards are physical and random, so the GM is the sensor: they can see
 * both the dealt row and the rules, and record each cut.
 *
 *   clean        — GM declared all-clear, no wrong cut, nothing forgiven
 *   complication — still defusing, OR cleared with one wrong cut absorbed by
 *                  Insulated Gloves (scraped it — the comedic middle)
 *   botched      — a wrong cut tripped the alarm, or time ran out first
 */
export function judge(state: DefuseState): Outcome {
  if (state.wrongCut) return 'botched';
  if (state.allClear) return state.wrongCutForgiven ? 'complication' : 'clean';
  if (state.timerExpired) return 'botched';
  return 'complication';
}

/**
 * Boost (wave 3, replacing Clear Channel): Insulated Gloves — the first wrong
 * cut doesn't trip the alarm, once per game. Shouted pre-emptively it arms;
 * shouted right after a recorded wrong cut it undoes it on the spot.
 */
export const insulatedGlovesBoost: BoostHook<DefuseState, DefuseParams> = {
  lane: 'charm',
  label: 'Insulated Gloves',
  apply(state): DefuseState {
    if (state.glovesArmed || state.wrongCutForgiven) return state;
    if (state.wrongCut) {
      // Fired after the mistake: take it back — the alarm never rang.
      return { ...state, wrongCut: false, wrongCutForgiven: true };
    }
    return { ...state, glovesArmed: true };
  },
};
