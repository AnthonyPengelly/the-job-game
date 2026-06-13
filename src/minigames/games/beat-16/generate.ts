import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export interface Beat16Params {
  /** Which beat number the player must tap on. */
  targetBeat: number;
  /** Metronome tempo in BPM. */
  bpm: number;
  /** How many beats play audibly before the metronome mutes. */
  audibleBeats: number;
  /** Half-width of the clean window in milliseconds (|delta| ≤ this → clean). */
  cleanWindowMs: number;
  /** Half-width of the complication window in milliseconds. */
  complicationWindowMs: number;
  /**
   * Subtracted from the GM's tap time before scoring. The player slaps the
   * table and the GM taps the moment they hear it — this compensates for that
   * hear-and-tap reaction chain so the player is scored on their slap.
   */
  reactionCompensationMs: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Beat 16 parameters from the resolved dial.
 *
 * Wave 4: stripped to two levers and a fixed audible count.
 *   - audibleBeats: ALWAYS 4 — you hear four, then count the rest in silence.
 *   - targetBeat: the beat to land on — easy 10, medium 15, brutal 20. The
 *     silent stretch is therefore targetBeat − 4 (6 / 11 / 16).
 *   - bpm: REVERSED from before — easy is FAST (~115), brutal is SLOW (~70).
 *     A slow tempo over a long silent count is harder to hold, not easier.
 *
 * Deterministic (no RNG jitter — fewer moving parts). cleanWindowMs and
 * complicationWindowMs are fixed skill thresholds. The Physical lane drives
 * dial.level via computeDial before generate is called.
 */
export function generate(_rng: Rng, dial: Difficulty): Beat16Params {
  const targetBeat = clamp(Math.round(12 + dial.level * 4), 10, 20);
  const bpm = clamp(Math.round(105 - dial.level * 16), 60, 120);

  // Always hear four, then count the remainder silently.
  const audibleBeats = Math.min(4, targetBeat - 1);

  return {
    targetBeat,
    bpm,
    audibleBeats,
    // Windows allow for the player-slap → GM-tap judging chain (two humans).
    cleanWindowMs: 250,
    complicationWindowMs: 600,
    reactionCompensationMs: 200,
  };
}
