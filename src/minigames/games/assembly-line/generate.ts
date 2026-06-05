import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

const SET_TYPE_POOL = ['Diamonds', 'Clubs', 'Hearts', 'Spades', 'Stars', 'Moons'] as const;

export interface AssemblyLineParams {
  /** Cards each player holds at the start. */
  handSize: number;
  /** Which set-types are active in this challenge (drawn from the pool). */
  setTypesInPlay: string[];
  /** Challenge timer in seconds. */
  timerSeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Generate Assembly Line parameters.
 *
 * Dial levers (higher dial.level = harder):
 *   - handSize: more cards per player (wider tolerance at lower dial)
 *   - setTypesInPlay.length: more types in play (fewer items at lower dial)
 *   - timerSeconds: less time (more time at lower dial)
 *
 * RNG draws which specific set-types are active; same seed+dial = same params.
 */
export function generate(rng: Rng, dial: Difficulty): AssemblyLineParams {
  const numTypes = clamp(Math.round(3 + dial.level * 0.5), 2, 5);
  const handSize = clamp(Math.round(4 + dial.level), 3, 7);
  const timerSeconds = clamp(Math.round(120 - dial.level * 20), 60, 180);

  const pool: string[] = [...SET_TYPE_POOL];
  const setTypesInPlay: string[] = [];
  for (let i = 0; i < numTypes; i++) {
    const picked = rng.pick(pool);
    setTypesInPlay.push(picked);
    pool.splice(pool.indexOf(picked), 1);
  }

  return { handSize, setTypesInPlay, timerSeconds };
}
