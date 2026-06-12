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
 * Generate Beat 16 parameters from the seeded RNG and the resolved dial.
 *
 * Dial levers (lower dial.level = easier):
 *   - targetBeat: fewer beats at lower difficulty (8..20); RNG adds ±1 variation
 *   - bpm: slower tempo at lower difficulty (60..120); RNG picks within a ±5 BPM window
 *   - audibleBeats: more audible beats at lower difficulty (targetBeat − 3 down to targetBeat − 10)
 *
 * cleanWindowMs and complicationWindowMs are fixed skill thresholds (not dial-driven).
 * The Physical lane drives dial.level via computeDial before generate is called.
 */
export function generate(rng: Rng, dial: Difficulty): Beat16Params {
  const targetBeatBase = clamp(Math.round(12 + dial.level * 4), 8, 20);
  const targetBeat = clamp(targetBeatBase + rng.int(-1, 1), 8, 20);
  const bpmBase = clamp(Math.round(80 + dial.level * 20), 60, 120);
  const bpm = clamp(bpmBase + rng.int(-5, 5), 60, 120);

  // Higher dial = fewer audible beats before muting (leaves more silent beats
  // to count). Wave 3: floor raised — counting just 2 silent beats was free.
  const silentCount = clamp(Math.round(4 + dial.level * 2), 3, 10);
  const audibleBeats = Math.max(1, targetBeat - silentCount);

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
