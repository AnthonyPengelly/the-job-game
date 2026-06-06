import React, { createContext, useContext, useEffect, useRef } from 'react';
import { createAudioEngine, loadDefaultSoundManifest } from '@/platform';
import type { AudioEngine } from '@/platform';
import type { ParsedSoundManifest } from '@/content/schema';
import { AudioClockContext } from '@/minigames/primitives';
import type { AudioClockHandle } from '@/minigames/primitives';
import { useAmbientBed } from './useAmbientBed';

// ── Public handle type ────────────────────────────────────────────────────────

/** The audio handle exposed to consumers via useAudio(). */
export interface AudioHandle {
  engine: AudioEngine;
  manifest: ParsedSoundManifest;
}

// ── React context (audio handle only — never game state) ──────────────────────

export const AudioHandleContext = createContext<AudioHandle | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface AudioProviderProps {
  children: React.ReactNode;
}

/**
 * Instantiates and owns the audio engine for the console shell.
 * Loads the bundled default sound manifest, creates the engine, and:
 *   - Preloads all cue buffers on mount.
 *   - Resumes the AudioContext on the first user gesture (click or keydown).
 *   - Exposes the engine + manifest through AudioHandleContext (useAudio).
 *   - Provides clock + scheduleBeep through AudioClockContext so the shared
 *     Metronome primitive can ride the precise audio clock (E9.3+).
 *
 * Holds only the audio handle in context — never game state.
 */
export function AudioProvider({ children }: AudioProviderProps) {
  // Create the engine once; stable across re-renders via ref.
  const handleRef = useRef<AudioHandle | null>(null);
  if (handleRef.current === null) {
    const manifest = loadDefaultSoundManifest();
    const engine = createAudioEngine(manifest);
    handleRef.current = { engine, manifest };
  }

  const { engine } = handleRef.current;

  // Stable clock handle for AudioClockContext.
  const clockHandleRef = useRef<AudioClockHandle | null>(null);
  if (clockHandleRef.current === null) {
    clockHandleRef.current = {
      clock: engine.clock,
      scheduleBeep: (when: number) => engine.scheduleBeep(when),
    };
  }

  useEffect(() => {
    void engine.preload();

    function handleGesture() {
      void engine.resume();
    }

    window.addEventListener('click', handleGesture, { once: true });
    window.addEventListener('keydown', handleGesture, { once: true });

    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [engine]);

  return (
    <AudioHandleContext.Provider value={handleRef.current}>
      <AudioClockContext.Provider value={clockHandleRef.current}>
        <AmbientBedWire />
        {children}
      </AudioClockContext.Provider>
    </AudioHandleContext.Provider>
  );
}

/**
 * Mounts inside both AudioHandleContext and AudioClockContext providers so that
 * useAmbientBed() → useAudio() → useContext(AudioHandleContext) resolves to the
 * handle above, not the null default. AudioProvider cannot call useAmbientBed()
 * in its own body because a component cannot consume a context it itself renders.
 */
function AmbientBedWire() {
  useAmbientBed();
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Returns the audio handle (engine + manifest), or null if not inside an AudioProvider. */
export function useAudio(): AudioHandle | null {
  return useContext(AudioHandleContext);
}
