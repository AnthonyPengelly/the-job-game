import { useCallback, useEffect, useRef } from 'react';

export interface MetronomeOptions {
  bpm: number;
  /** How many beats play audibly before muting. 0 = always audible. */
  audibleBeats: number;
}

export interface MetronomeHandle {
  /** Register a callback fired on each beat. Replaces any previous handler. */
  onBeat(cb: (beatNumber: number) => void): void;
  /** Silence subsequent audible beats. */
  mute(): void;
}

/** Pure predicate: should beat N play a sound given current mute state and audible-beat limit? */
export function isBeatAudible(beat: number, muted: boolean, audibleBeats: number): boolean {
  return !muted && (audibleBeats === 0 || beat <= audibleBeats);
}

/**
 * Precise Web Audio clock-based metronome (not setTimeout).
 * Returns a stable handle; the hook cleans up on unmount or when bpm/audibleBeats change.
 * E9 will integrate this with the shared audio engine.
 */
export function useMetronome({ bpm, audibleBeats }: MetronomeOptions): MetronomeHandle {
  const beatCallbackRef = useRef<((n: number) => void) | null>(null);
  const mutedRef = useRef(false);
  const schedulerRef = useRef<{ stop(): void } | null>(null);

  useEffect(() => {
    mutedRef.current = false;
    const intervalMs = (60 / bpm) * 1000;
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

    let nextBeatTime = audioCtx ? audioCtx.currentTime + 0.1 : 0;
    let running = true;

    const tick = () => {
      if (!running) return;

      const now = audioCtx ? audioCtx.currentTime : 0;
      // Schedule any beats due in the next 100ms lookahead
      while (nextBeatTime < now + 0.1) {
        const beat = beatCount + 1;
        if (isBeatAudible(beat, mutedRef.current, audibleBeats) && audioCtx) {
          scheduleBeep(nextBeatTime);
        }
        beatCallbackRef.current?.(beat);
        beatCount++;
        nextBeatTime += intervalMs / 1000;
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
      const id = setInterval(tick, 25);
      schedulerRef.current = {
        stop: () => {
          running = false;
          clearInterval(id);
          void audioCtx?.close();
        },
      };
    }

    return () => {
      running = false;
      schedulerRef.current?.stop();
      schedulerRef.current = null;
    };
  }, [bpm, audibleBeats]);

  const onBeat = useCallback((cb: (n: number) => void) => {
    beatCallbackRef.current = cb;
  }, []);

  const mute = useCallback(() => {
    mutedRef.current = true;
  }, []);

  return { onBeat, mute };
}
