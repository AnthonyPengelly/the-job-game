/**
 * Precise Web-Audio-clock-based scheduler.
 *
 * Built on `audioContext.currentTime` — never wall-clock (`Date.now`,
 * `setTimeout` for timing accuracy). The scheduler loop runs on a cheap
 * `setInterval` that merely *checks* whether anything needs scheduling in the
 * next `lookahead` seconds; actual audio events are anchored to the
 * sub-millisecond audio clock.
 *
 * Used by the shared Metronome (E9.3) so beat callbacks are anchored to the
 * same clock as the audio output, eliminating `setTimeout` drift.
 */

export interface ScheduledEntry {
  time: number;
  cb: () => void;
}

export interface AudioClock {
  /** Current audio context time in seconds. Returns 0 when no context. */
  now(): number;
  /**
   * Schedule `cb` to fire at audio-clock time `time`.
   * If `time` is in the past or there is no context, fires immediately.
   */
  scheduleAt(time: number, cb: () => void): void;
  /** Start the scheduler loop (idempotent). */
  start(): void;
  /** Stop the scheduler loop and flush all pending callbacks. */
  stop(): void;
}

export interface AudioClockOptions {
  /** How far ahead (seconds) to look for pending callbacks. Default 0.1. */
  lookahead?: number;
  /** How often (ms) to poll for due callbacks. Default 25. */
  intervalMs?: number;
  /** Injected `getTime` — for testing without a real AudioContext. */
  getTime?: () => number;
}

export function createClock(opts: AudioClockOptions = {}): AudioClock {
  const lookahead = opts.lookahead ?? 0.1;
  const intervalMs = opts.intervalMs ?? 25;
  const getTime = opts.getTime ?? (() => 0);

  const pending: ScheduledEntry[] = [];
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function flush() {
    const t = getTime();
    // Drain all entries whose time is within the lookahead window
    let i = 0;
    while (i < pending.length) {
      const entry = pending[i];
      if (entry !== undefined && entry.time <= t + lookahead) {
        pending.splice(i, 1);
        entry.cb();
      } else {
        i++;
      }
    }
  }

  return {
    now(): number {
      return getTime();
    },

    scheduleAt(time: number, cb: () => void): void {
      if (time <= getTime()) {
        cb();
        return;
      }
      // Insert in ascending time order
      let pos = pending.length;
      for (let i = 0; i < pending.length; i++) {
        const e = pending[i];
        if (e !== undefined && e.time > time) {
          pos = i;
          break;
        }
      }
      pending.splice(pos, 0, { time, cb });
    },

    start(): void {
      if (intervalId !== null) return;
      intervalId = setInterval(flush, intervalMs);
    },

    stop(): void {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      // Fire any remaining callbacks immediately
      const remaining = pending.splice(0);
      for (const entry of remaining) {
        entry.cb();
      }
    },
  };
}
