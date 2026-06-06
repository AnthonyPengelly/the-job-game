import { useCallback, useEffect, useRef } from 'react';
import type { AudioClock } from '@/platform/audio';

export interface MetronomeOptions {
  bpm: number;
  /** How many beats play audibly before muting. 0 = always audible. */
  audibleBeats: number;
  /**
   * Optional precise audio clock from the shared AudioEngine (E9.2+).
   * When provided, beat timing is anchored to audioCtx.currentTime — no
   * private AudioContext is created and there is no setTimeout drift.
   * When absent, falls back to a private AudioContext + oscillator beeps.
   */
  clock?: AudioClock | null;
  /**
   * Beep emitter for the clock path. Called with the audio-clock time (seconds)
   * at which the beep should sound, subject to `audibleBeats` and `mute()`.
   * Provided alongside `clock` by the shared AudioEngine handle (E9.4+).
   * When absent, the clock path produces no sound (same as the fallback path
   * when AudioContext is unavailable).
   */
  scheduleBeep?: ((when: number) => void) | null;
}

export interface MetronomeHandle {
  /** Register a callback fired on each beat. Replaces any previous handler. */
  onBeat(cb: (beatNumber: number) => void): void;
  /** Silence subsequent audible beats on all paths (clock path and fallback). */
  mute(): void;
}

/** Pure predicate: should beat N play a sound given current mute state and audible-beat limit? */
export function isBeatAudible(beat: number, muted: boolean, audibleBeats: number): boolean {
  return !muted && (audibleBeats === 0 || beat <= audibleBeats);
}

/** Lookahead window in seconds for the scheduler tick. */
const LOOKAHEAD_SEC = 0.1;
/** Polling interval for the scheduler tick in milliseconds. */
const TICK_MS = 25;

/**
 * Precise Web Audio clock-based metronome.
 *
 * When `clock` is supplied (from the shared AudioEngine), beats are anchored to
 * `audioCtx.currentTime` — identical to the audio engine's clock — eliminating
 * any drift between audio output and beat callbacks.
 *
 * When `clock` is absent, falls back to a private AudioContext with an
 * oscillator beep (same lookahead-scheduler approach), or a plain setInterval
 * if AudioContext is unavailable.
 *
 * Returns a stable handle; the hook cleans up on unmount or when options change.
 */
export function useMetronome({ bpm, audibleBeats, clock, scheduleBeep }: MetronomeOptions): MetronomeHandle {
  const beatCallbackRef = useRef<((n: number) => void) | null>(null);
  const mutedRef = useRef(false);
  const schedulerRef = useRef<{ stop(): void } | null>(null);

  useEffect(() => {
    mutedRef.current = false;
    const intervalSec = 60 / bpm;

    if (clock != null) {
      // ── Precise audio-clock path ──────────────────────────────────────────
      // No private AudioContext. Beat timing is driven entirely by clock.now().
      // Audible beats are emitted via scheduleBeep (provided alongside clock
      // by the shared AudioEngine handle). Without scheduleBeep, the clock path
      // produces no sound — pass both from AudioClockContext (E9.4+).
      let beatCount = 0;
      let nextBeatTime = clock.now() + LOOKAHEAD_SEC;
      let running = true;

      const tick = () => {
        if (!running) return;
        const now = clock.now();
        while (nextBeatTime < now + LOOKAHEAD_SEC) {
          const beat = beatCount + 1;
          if (scheduleBeep && isBeatAudible(beat, mutedRef.current, audibleBeats)) {
            scheduleBeep(nextBeatTime);
          }
          beatCallbackRef.current?.(beat);
          beatCount++;
          nextBeatTime += intervalSec;
        }
      };

      const id = setInterval(tick, TICK_MS);
      schedulerRef.current = {
        stop: () => {
          running = false;
          clearInterval(id);
        },
      };
    } else {
      // ── Fallback path: private AudioContext ───────────────────────────────
      // Used when no shared engine is available (early startup, tests without a
      // provider, or browsers without AudioContext support).
      const intervalMs = intervalSec * 1000;
      let beatCount = 0;
      let audioCtx: AudioContext | null = null;

      try {
        audioCtx = new AudioContext();
      } catch {
        // AudioContext unavailable — beats fire via setInterval but no sound
      }

      const scheduleBeep = (when: number) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
        osc.start(when);
        osc.stop(when + 0.06);
      };

      let nextBeatTime = audioCtx ? audioCtx.currentTime + LOOKAHEAD_SEC : 0;
      let running = true;

      const tick = () => {
        if (!running) return;
        const now = audioCtx ? audioCtx.currentTime : 0;
        while (nextBeatTime < now + LOOKAHEAD_SEC) {
          const beat = beatCount + 1;
          if (isBeatAudible(beat, mutedRef.current, audibleBeats) && audioCtx) {
            scheduleBeep(nextBeatTime);
          }
          beatCallbackRef.current?.(beat);
          beatCount++;
          nextBeatTime += intervalSec;
        }
      };

      if (!audioCtx) {
        let fallbackCount = 0;
        const id = setInterval(() => {
          fallbackCount++;
          beatCallbackRef.current?.(fallbackCount);
        }, intervalMs);
        schedulerRef.current = { stop: () => clearInterval(id) };
      } else {
        const id = setInterval(tick, TICK_MS);
        schedulerRef.current = {
          stop: () => {
            running = false;
            clearInterval(id);
            void audioCtx?.close();
          },
        };
      }
    }

    return () => {
      schedulerRef.current?.stop();
      schedulerRef.current = null;
    };
  }, [bpm, audibleBeats, clock, scheduleBeep]);

  const onBeat = useCallback((cb: (n: number) => void) => {
    beatCallbackRef.current = cb;
  }, []);

  const mute = useCallback(() => {
    mutedRef.current = true;
  }, []);

  return { onBeat, mute };
}
