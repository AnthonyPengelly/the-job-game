import { createContext, useContext } from 'react';
import type { AudioClock } from '@/platform/audio';

/**
 * Provides the shared AudioClock from the audio engine to Metronome consumers.
 * E9.4's AudioProvider wraps the console with the real clock; without a provider
 * the context returns null and useMetronome falls back to its own AudioContext.
 */
export const AudioClockContext = createContext<AudioClock | null>(null);

/** Returns the shared AudioClock if provided by a parent AudioProvider, or null. */
export function useAudioClock(): AudioClock | null {
  return useContext(AudioClockContext);
}
