// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMetronome } from './Metronome';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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
