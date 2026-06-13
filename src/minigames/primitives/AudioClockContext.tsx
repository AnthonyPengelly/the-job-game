import { createContext, useContext } from 'react';
import type { AudioClock } from '@/platform/audio';

/**
 * Everything the Metronome needs from the shared audio engine: a precise clock
 * for beat timing, and a beep emitter so the clock path can honor `audibleBeats`
 * and `mute()`. Both are provided together by E9.4's AudioProvider (they come
 * from the same AudioEngine instance). Without a provider the context is null
 * and useMetronome falls back to its private AudioContext.
 */
export interface AudioClockHandle {
  clock: AudioClock;
  /** Schedule an audible tick beep at the given audio clock time (seconds), optionally pitched. */
  scheduleBeep: (when: number, frequency?: number) => void;
  /**
   * Optional: signal that a mini-game timer started/stopped running. The
   * console's AudioProvider ref-counts these to drive the tense ambient layer
   * (playtest wave 2). Dependency-inverted so the minigames layer never
   * imports console audio.
   */
  setTimerSoundscape?: (active: boolean) => void;
}

export const AudioClockContext = createContext<AudioClockHandle | null>(null);

/** Returns the shared AudioClock if provided by a parent AudioProvider, or null. */
export function useAudioClock(): AudioClock | null {
  return useContext(AudioClockContext)?.clock ?? null;
}

/** Returns the beep scheduler if provided by a parent AudioProvider, or null. */
export function useScheduleBeep(): ((when: number, frequency?: number) => void) | null {
  return useContext(AudioClockContext)?.scheduleBeep ?? null;
}

/** Returns the timer-soundscape signal if provided by a parent AudioProvider, or null. */
export function useTimerSoundscape(): ((active: boolean) => void) | null {
  return useContext(AudioClockContext)?.setTimerSoundscape ?? null;
}
