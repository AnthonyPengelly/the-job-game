/**
 * Seeded PRNG — mulberry32 algorithm.
 *
 * Usage: const rng = mulberry32(seed); rng.next(); // [0, 1)
 *
 * The engine never calls Math.random. All randomness flows through an explicit
 * instance created from the run seed and threaded through the engine functions.
 * Same seed + same call sequence => identical stream (determinism / replay).
 */

export interface Rng {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Picks a random element from a non-empty array. */
  pick<T>(arr: readonly [T, ...T[]] | T[]): T;
  /** Returns the current internal state word. Passing this to mulberry32()
   *  (or rngFromState()) resumes the identical stream from this point. */
  state(): number;
}

export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;

  function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }

  function int(min: number, max: number): number {
    if (min > max) throw new RangeError(`int: min (${min}) must be <= max (${max})`);
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError('pick: array must be non-empty');
    // index is bounds-checked above; element is present
    return arr[int(0, arr.length - 1)] as T;
  }

  return { next, int, pick, state: () => s };
}

/** Alias for mulberry32 — resume an RNG stream from a captured state word. */
export function rngFromState(s: number): Rng {
  return mulberry32(s);
}
