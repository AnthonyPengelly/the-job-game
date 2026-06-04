import { describe, it, expect } from 'vitest';
import { mulberry32, rngFromState } from '@/engine/rng';

describe('mulberry32', () => {
  it('same seed produces the same sequence', () => {
    const a = mulberry32(1312);
    const b = mulberry32(1312);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('a fresh instance from the same seed reproduces an earlier stream exactly', () => {
    const first = mulberry32(42);
    const snapshot = Array.from({ length: 10 }, () => first.next());

    const second = mulberry32(42);
    const replay = Array.from({ length: 10 }, () => second.next());

    expect(replay).toEqual(snapshot);
  });

  it('different seeds produce different streams', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const as = Array.from({ length: 10 }, () => a.next());
    const bs = Array.from({ length: 10 }, () => b.next());
    expect(as).not.toEqual(bs);
  });

  it('next() returns floats in [0, 1)', () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() returns integers in [min, max] inclusive and is deterministic', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = a.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(b.int(1, 6)).toBe(v);
    }
  });

  it('pick() selects from array deterministically and same seed reproduces picks', () => {
    const items = ['a', 'b', 'c', 'd', 'e'] as const;
    const a = mulberry32(314);
    const b = mulberry32(314);
    for (let i = 0; i < 20; i++) {
      const pa = a.pick(items);
      const pb = b.pick(items);
      expect(items).toContain(pa);
      expect(pa).toBe(pb);
    }
  });

  it('pick() throws on empty array', () => {
    const rng = mulberry32(0);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('seed 0 and seed 2^32-1 produce valid streams (edge seeds)', () => {
    for (const seed of [0, 0xffffffff]) {
      const rng = mulberry32(seed);
      for (let i = 0; i < 10; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('produces a known fixed sequence for seed 1312 (regression anchor)', () => {
    const rng = mulberry32(1312);
    const first5 = Array.from({ length: 5 }, () => rng.next());
    // Inline literals catch accidental PRNG changes; do not update without justification.
    expect(first5).toEqual([
      0.9590687416493893,
      0.6893134724814445,
      0.3788896659389138,
      0.3436102077830583,
      0.41180735221132636,
    ]);
  });

  it('int() throws when min > max', () => {
    const rng = mulberry32(0);
    expect(() => rng.int(6, 1)).toThrow(RangeError);
  });
});

describe('Rng.state() + resume', () => {
  it('state() returns the current internal state before the next draw', () => {
    const rng = mulberry32(1312);
    // Advance a few steps
    rng.next();
    rng.next();
    const captured = rng.state();
    // The next draw from the original…
    const fromOriginal = rng.next();
    // …must equal the first draw from a resumed RNG
    const resumed = mulberry32(captured);
    expect(resumed.next()).toBe(fromOriginal);
  });

  it('mulberry32(capturedState) reproduces the exact continuing stream', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 5; i++) rng.next();
    const captured = rng.state();
    const tail = Array.from({ length: 10 }, () => rng.next());

    const resumed = mulberry32(captured);
    const replay = Array.from({ length: 10 }, () => resumed.next());
    expect(replay).toEqual(tail);
  });

  it('rngFromState is an alias that produces the same stream as mulberry32', () => {
    const s = 0xdeadbeef;
    const a = mulberry32(s);
    const b = rngFromState(s);
    for (let i = 0; i < 20; i++) {
      expect(b.next()).toBe(a.next());
    }
  });

  it('capturing state at position 0 (before any draw) resumes identically', () => {
    const rng = mulberry32(999);
    const s0 = rng.state();
    const fullStream = Array.from({ length: 15 }, () => rng.next());
    const resumed = mulberry32(s0);
    const replayStream = Array.from({ length: 15 }, () => resumed.next());
    expect(replayStream).toEqual(fullStream);
  });
});
