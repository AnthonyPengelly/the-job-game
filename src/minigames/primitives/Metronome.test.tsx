// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AudioClock } from '@/platform/audio';
import { useMetronome, isBeatAudible, createResilientNow } from './Metronome';

/** Mirrors the TICK_MS constant in Metronome.tsx — the scheduler polling interval. */
const TICK_MS = 25;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isBeatAudible', () => {
  it('returns false when muted', () => {
    expect(isBeatAudible(1, true, 0)).toBe(false);
    expect(isBeatAudible(1, true, 4)).toBe(false);
  });

  it('returns true for any beat when audibleBeats=0 (always-on)', () => {
    expect(isBeatAudible(1, false, 0)).toBe(true);
    expect(isBeatAudible(100, false, 0)).toBe(true);
  });

  it('returns true for beats within the audible window', () => {
    expect(isBeatAudible(1, false, 4)).toBe(true);
    expect(isBeatAudible(4, false, 4)).toBe(true);
  });

  it('returns false for beats beyond the audible window', () => {
    expect(isBeatAudible(5, false, 4)).toBe(false);
    expect(isBeatAudible(100, false, 4)).toBe(false);
  });
});

describe('useMetronome (fallback path — no clock)', () => {
  it('emits beats via onBeat callback', () => {
    const { result } = renderHook(() => useMetronome({ bpm: 120, audibleBeats: 0 }));
    const beats: number[] = [];
    act(() => {
      result.current.onBeat((n) => beats.push(n));
    });
    // Advance 1 second — 120 bpm = 2 beats/s
    act(() => { vi.advanceTimersByTime(1000); });
    expect(beats.length).toBeGreaterThanOrEqual(1);
  });

  it('mute() stops audible beeps (does not throw)', () => {
    const { result } = renderHook(() => useMetronome({ bpm: 60, audibleBeats: 4 }));
    act(() => {
      result.current.onBeat(() => {});
      result.current.mute();
    });
    // Should not throw after muting
    act(() => { vi.advanceTimersByTime(500); });
  });

  it('beat count increments sequentially', () => {
    const { result } = renderHook(() => useMetronome({ bpm: 120, audibleBeats: 0 }));
    const beats: number[] = [];
    act(() => {
      result.current.onBeat((n) => beats.push(n));
    });
    act(() => { vi.advanceTimersByTime(2000); });
    // Verify beats are sequential starting from 1
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i]).toBe(beats[i - 1]! + 1);
    }
  });

  it('cleans up on unmount without throwing', () => {
    const { unmount } = renderHook(() => useMetronome({ bpm: 60, audibleBeats: 2 }));
    expect(() => {
      act(() => unmount());
    }).not.toThrow();
  });
});

// ── Audio-clock accuracy tests (E9.3 gate) ────────────────────────────────────
//
// These tests prove that beat timing is anchored to the audio clock's
// `currentTime`, NOT to wall time / setTimeout duration. The key assertion:
//   - Advancing wall time alone (setInterval ticks) does NOT fire beats.
//   - Only advancing the mock audio clock's `now()` causes beats to fire.

describe('useMetronome — clock-based timing (audio clock, not setTimeout)', () => {
  function makeMockClock(getNow: () => number): AudioClock {
    return {
      now: getNow,
      scheduleAt: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  it('beats are time-anchored: no advancing time source ⇒ no beats, however many ticks', () => {
    const audioNow = 0;
    const clock = makeMockClock(() => audioNow);
    // Freeze the wall clock too — with a stalled audio clock the metronome falls
    // back to wall time after the probe window; freezing both proves beats are
    // driven by a time source, never by tick counts.
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => 0);

    const { result } = renderHook(() =>
      useMetronome({ bpm: 60, audibleBeats: 0, clock }),
    );

    const beats: number[] = [];
    act(() => { result.current.onBeat((n) => beats.push(n)); });

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(beats.length).toBe(0);
    perfSpy.mockRestore();
  });

  it('beats fire once audio clock advances past the lookahead threshold', () => {
    let audioNow = 0;
    const clock = makeMockClock(() => audioNow);

    const { result } = renderHook(() =>
      useMetronome({ bpm: 60, audibleBeats: 0, clock }),
    );

    const beats: number[] = [];
    act(() => { result.current.onBeat((n) => beats.push(n)); });

    // A couple of ticks with the clock still at 0 (inside the stall-probe window)
    act(() => { vi.advanceTimersByTime(TICK_MS * 2); });
    expect(beats.length).toBe(0);

    // Advance audio clock just past the lookahead: nextBeatTime=0.1, need now > 0
    audioNow = 0.05;
    act(() => { vi.advanceTimersByTime(TICK_MS); });
    // 0.1 < 0.05 + 0.1 = 0.15 → true → beat 1 fires
    expect(beats.length).toBe(1);
    expect(beats[0]).toBe(1);
  });

  it('inter-beat interval matches BPM measured against the audio clock', () => {
    // 120 BPM → 0.5 s per beat
    // nextBeatTime starts at 0 + 0.1 = 0.1 s
    // Beat 2 scheduled at 0.1 + 0.5 = 0.6 s
    // Beat 3 scheduled at 0.1 + 1.0 = 1.1 s
    let audioNow = 0;
    const clock = makeMockClock(() => audioNow);

    const { result } = renderHook(() =>
      useMetronome({ bpm: 120, audibleBeats: 0, clock }),
    );

    const beatsFired: number[] = [];
    act(() => { result.current.onBeat((n) => beatsFired.push(n)); });

    // Trigger beat 1: need audioNow s.t. 0.1 < audioNow + 0.1 → audioNow > 0
    audioNow = 0.05;
    act(() => { vi.advanceTimersByTime(TICK_MS); });
    expect(beatsFired).toEqual([1]);

    // Trigger beat 2: nextBeatTime = 0.6, need audioNow > 0.5
    audioNow = 0.55;
    act(() => { vi.advanceTimersByTime(TICK_MS); });
    expect(beatsFired).toEqual([1, 2]);

    // Trigger beat 3: nextBeatTime = 1.1, need audioNow > 1.0
    audioNow = 1.05;
    act(() => { vi.advanceTimersByTime(TICK_MS); });
    expect(beatsFired).toEqual([1, 2, 3]);

    // The audio-clock gaps between trigger points are exactly 0.5 s each,
    // matching 120 BPM (0.5 s / beat). No wall-clock measurement needed.
  });

  it('beat numbers are sequential and start from 1 with clock path', () => {
    let audioNow = 0;
    const clock = makeMockClock(() => audioNow);

    const { result } = renderHook(() =>
      useMetronome({ bpm: 60, audibleBeats: 0, clock }),
    );

    const beats: number[] = [];
    act(() => { result.current.onBeat((n) => beats.push(n)); });

    for (let i = 1; i <= 4; i++) {
      audioNow = i * 1.05;
      act(() => { vi.advanceTimersByTime(TICK_MS); });
    }

    expect(beats.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i]).toBe(beats[i - 1]! + 1);
    }
    expect(beats[0]).toBe(1);
  });

  it('mute() does not suppress beat callbacks (only suppresses sound)', () => {
    let audioNow = 0;
    const clock = makeMockClock(() => audioNow);

    const { result } = renderHook(() =>
      useMetronome({ bpm: 60, audibleBeats: 4, clock }),
    );

    const beats: number[] = [];
    act(() => {
      result.current.onBeat((n) => beats.push(n));
      result.current.mute();
    });

    audioNow = 0.05;
    act(() => { vi.advanceTimersByTime(TICK_MS); });
    // Beat callbacks still fire after mute (only audio is silenced)
    expect(beats.length).toBe(1);
  });

  it('cleans up on unmount without throwing (clock path)', () => {
    const audioNow = 0;
    const clock = makeMockClock(() => audioNow);
    const { unmount } = renderHook(() =>
      useMetronome({ bpm: 60, audibleBeats: 2, clock }),
    );
    expect(() => {
      act(() => unmount());
    }).not.toThrow();
  });

  // ── scheduleBeep tests ────────────────────────────────────────────────────

  it('scheduleBeep is called for each audible beat when audibleBeats=0 (always-on)', () => {
    let audioNow = 0;
    const clock = makeMockClock(() => audioNow);
    const scheduleBeep = vi.fn();

    const { result } = renderHook(() =>
      useMetronome({ bpm: 60, audibleBeats: 0, clock, scheduleBeep }),
    );
    act(() => { result.current.onBeat(() => {}); });

    audioNow = 0.05;
    act(() => { vi.advanceTimersByTime(TICK_MS); });
    expect(scheduleBeep).toHaveBeenCalledTimes(1);

    audioNow = 1.05;
    act(() => { vi.advanceTimersByTime(TICK_MS); });
    expect(scheduleBeep).toHaveBeenCalledTimes(2);
  });

  it('scheduleBeep is only called for beats within the audibleBeats window', () => {
    let audioNow = 0;
    const clock = makeMockClock(() => audioNow);
    const scheduleBeep = vi.fn();

    // 60 BPM, 2 audible beats — beats 1 and 2 play, beat 3+ are silent
    renderHook(() =>
      useMetronome({ bpm: 60, audibleBeats: 2, clock, scheduleBeep }),
    );

    // Fire beats 1, 2, 3 by advancing the audio clock
    for (let i = 1; i <= 3; i++) {
      audioNow = i * 1.05;
      act(() => { vi.advanceTimersByTime(TICK_MS); });
    }

    // Only 2 beeps should have been scheduled
    expect(scheduleBeep).toHaveBeenCalledTimes(2);
  });

  it('scheduleBeep is suppressed after mute()', () => {
    let audioNow = 0;
    const clock = makeMockClock(() => audioNow);
    const scheduleBeep = vi.fn();

    const { result } = renderHook(() =>
      useMetronome({ bpm: 60, audibleBeats: 0, clock, scheduleBeep }),
    );

    // Mute before any beats fire
    act(() => { result.current.mute(); });

    audioNow = 0.05;
    act(() => { vi.advanceTimersByTime(TICK_MS); });
    // Beat callback still fires but scheduleBeep must not be called
    expect(scheduleBeep).not.toHaveBeenCalled();
  });

  it('scheduleBeep is called with the beat audio time (not wall time)', () => {
    let audioNow = 0;
    const clock = makeMockClock(() => audioNow);
    const scheduleBeep = vi.fn();

    renderHook(() =>
      useMetronome({ bpm: 60, audibleBeats: 0, clock, scheduleBeep }),
    );

    // 60 BPM → 1 s/beat; nextBeatTime starts at 0 + 0.1 = 0.1 s
    audioNow = 0.05;
    act(() => { vi.advanceTimersByTime(TICK_MS); });
    expect(scheduleBeep).toHaveBeenCalledWith(0.1);
  });
});


describe('createResilientNow (stalled audio clock fallback)', () => {
  it('passes through audio time while the source advances', () => {
    let audioNow = 1.0;
    const time = createResilientNow(() => audioNow);
    audioNow = 1.5;
    expect(time.now()).toBe(1.5);
    expect(time.usingWallClock()).toBe(false);
  });

  it('falls back to wall-clock time when the source never advances (suspended context)', () => {
    const perfSpy = vi.spyOn(performance, 'now');
    let wallMs = 10_000;
    perfSpy.mockImplementation(() => wallMs);

    const time = createResilientNow(() => 2.0); // frozen audio clock
    // Probe phase: stalled reads hold the anchor
    for (let i = 0; i < 8; i++) {
      expect(time.now()).toBe(2.0);
    }
    expect(time.usingWallClock()).toBe(true);
    // Wall mode: time now advances with performance.now(), anchored at 2.0s
    wallMs = 10_500;
    expect(time.now()).toBeCloseTo(2.5, 5);
    perfSpy.mockRestore();
  });

  it('beats fire on a clock whose audio source is frozen (suspended-context stall)', () => {
    // Wall clock is mocked to advance in lockstep with the fake timers so the
    // post-probe wall-clock fallback has time to flow from.
    let wallMs = 0;
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => wallMs);

    let calls = 0;
    const clock = makeFrozenClock();
    const { result } = renderHook(() =>
      useMetronome({ bpm: 600, audibleBeats: 0, clock, scheduleBeep: null }),
    );
    act(() => { result.current.onBeat(() => { calls++; }); });

    // 600 BPM → 0.1 s/beat. Tick past the probe window (8 ticks · 25 ms) and on.
    act(() => {
      for (let i = 0; i < 40; i++) {
        wallMs += TICK_MS;
        vi.advanceTimersByTime(TICK_MS);
      }
    });
    expect(calls).toBeGreaterThan(0);
    perfSpy.mockRestore();
  });
});

function makeFrozenClock(): AudioClock {
  return {
    now: () => 3.0,
    scheduleAt: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}
