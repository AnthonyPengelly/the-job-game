import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioEngine, loadDefaultSoundManifest, createBundledFetchBuffer } from '@/platform';
import type { AudioEngine } from '@/platform';
import type { ParsedSoundManifest } from '@/content/schema';
import { AudioClockContext } from '@/minigames/primitives';
import type { AudioClockHandle } from '@/minigames/primitives';
import { useAmbientBed } from './useAmbientBed';
import { usePhaseAudioSync } from './usePhaseAudioSync';

// ── Public handle types ───────────────────────────────────────────────────────

/** The stable audio handle (engine + manifest) exposed via useAudio(). */
export interface AudioHandle {
  engine: AudioEngine;
  manifest: ParsedSoundManifest;
}

/**
 * Shared, reactive audio master controls.
 * Provided by AudioProvider alongside AudioHandleContext so that all consumers
 * (Soundboard drawer, Settings dialog) read the same muted/volume state and
 * never disagree about whether audio is muted.
 */
export interface AudioSettingsHandle {
  muted: boolean;
  volume: number;
  setMuted: (v: boolean) => void;
  setVolume: (v: number) => void;
}

// ── React contexts ────────────────────────────────────────────────────────────

export const AudioHandleContext = createContext<AudioHandle | null>(null);
export const AudioSettingsContext = createContext<AudioSettingsHandle | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface AudioProviderProps {
  children: React.ReactNode;
}

/**
 * Instantiates and owns the audio engine for the console shell.
 * Loads the bundled default sound manifest, creates the engine, and:
 *   - Preloads all cue buffers on mount.
 *   - Resumes the AudioContext on the first user gesture (click or keydown).
 *   - Exposes the stable engine + manifest through AudioHandleContext (useAudio).
 *   - Exposes shared reactive master-mute/volume through AudioSettingsContext
 *     (useAudioSettings) so Soundboard and Settings dialog never disagree.
 *   - Provides clock + scheduleBeep through AudioClockContext so the shared
 *     Metronome primitive can ride the precise audio clock (E9.3+).
 *
 * Holds only the audio handle in context — never game state.
 */
export function AudioProvider({ children }: AudioProviderProps) {
  // Create the engine once; stable across re-renders via ref.
  const engineRef = useRef<AudioEngine | null>(null);
  const manifestRef = useRef<ParsedSoundManifest | null>(null);
  if (engineRef.current === null) {
    manifestRef.current = loadDefaultSoundManifest();
    engineRef.current = createAudioEngine(manifestRef.current!, { fetchBuffer: createBundledFetchBuffer() });
  }
  const engine = engineRef.current!;
  const manifest = manifestRef.current!;

  // Stable handle object for AudioHandleContext (reference never changes).
  const handleRef = useRef<AudioHandle>({ engine, manifest });

  // Reactive master audio controls — shared across all consumers.
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(1);

  const setMuted = useCallback((v: boolean) => {
    engine.mute(v);
    setMutedState(v);
  }, [engine]);

  const setVolume = useCallback((v: number) => {
    engine.setMasterGain(v);
    setVolumeState(v);
  }, [engine]);

  // Reconstruct settings object only when muted/volume/callbacks change.
  const settings = useMemo<AudioSettingsHandle>(
    () => ({ muted, volume, setMuted, setVolume }),
    [muted, volume, setMuted, setVolume],
  );

  // Stable clock handle for AudioClockContext.
  // setTimerSoundscape ref-counts running mini-game timers and lays the tense
  // ambient loop over the bed while any clock is live (playtest wave 2).
  const timerCountRef = useRef(0);
  const clockHandleRef = useRef<AudioClockHandle | null>(null);
  if (clockHandleRef.current === null) {
    clockHandleRef.current = {
      clock: engine.clock,
      scheduleBeep: (when: number) => engine.scheduleBeep(when),
      setTimerSoundscape: (active: boolean) => {
        timerCountRef.current = Math.max(0, timerCountRef.current + (active ? 1 : -1));
        if (active && timerCountRef.current === 1) {
          engine.play('ambient-tension');
        } else if (!active && timerCountRef.current === 0) {
          engine.stop('ambient-tension');
        }
      },
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
      <AudioSettingsContext.Provider value={settings}>
        <AudioClockContext.Provider value={clockHandleRef.current}>
          <AmbientBedWire />
          {children}
        </AudioClockContext.Provider>
      </AudioSettingsContext.Provider>
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
  usePhaseAudioSync();
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Returns the stable audio handle (engine + manifest), or null if not inside an AudioProvider. */
export function useAudio(): AudioHandle | null {
  return useContext(AudioHandleContext);
}

/** Returns shared reactive master-mute/volume, or null if not inside an AudioProvider. */
export function useAudioSettings(): AudioSettingsHandle | null {
  return useContext(AudioSettingsContext);
}
