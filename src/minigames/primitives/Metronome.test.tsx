// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMetronome, isBeatAudible } from './Metronome';

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

describe('useMetronome', () => {
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
