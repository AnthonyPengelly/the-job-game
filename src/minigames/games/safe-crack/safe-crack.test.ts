import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, computeFeedback, techBoost, stealthBoost } from './judge';
import type { SafeCrackState } from './judge';
import { safeCrack } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ─────────────────────────────────────────────────────────────────

describe('safeCrack registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('safeCrack')).toBe(safeCrack);
  });

  it('has id safeCrack', () => {
    expect(safeCrack.id).toBe('safeCrack');
  });

  it('has lanes tech and stealth', () => {
    expect(safeCrack.lanes).toEqual(['tech', 'stealth']);
  });

  it('has minCommit 1', () => {
    expect(safeCrack.minCommit).toBe(1);
  });

  it('has two boost hooks', () => {
    expect(safeCrack.boosts).toHaveLength(2);
  });
});

// ── Generator reproducibility ─────────────────────────────────────────────────

describe('generate — reproducibility', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    const p1 = generate(mulberry32(1312), d);
    const p2 = generate(mulberry32(1312), d);
    expect(p1).toEqual(p2);
  });

  it('different seeds produce different codes (at dial=0)', () => {
    const p1 = generate(mulberry32(1), dial(0));
    const p2 = generate(mulberry32(9999), dial(0));
    expect(p1.code).not.toEqual(p2.code);
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ more digits', () => {
    const easy = generate(mulberry32(42), dial(-1));
    const hard = generate(mulberry32(42), dial(1));
    expect(hard.code.length).toBeGreaterThanOrEqual(easy.code.length);
  });

  it('higher dial ⇒ fewer guesses', () => {
    const easy = generate(mulberry32(42), dial(-1));
    const hard = generate(mulberry32(42), dial(1));
    expect(hard.guessBudget).toBeLessThanOrEqual(easy.guessBudget);
  });

  it('higher dial ⇒ less time', () => {
    const easy = generate(mulberry32(42), dial(-1));
    const hard = generate(mulberry32(42), dial(1));
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('clamps digit count to minimum 3', () => {
    expect(generate(mulberry32(1), dial(-100)).code.length).toBe(3);
  });

  it('clamps digit count to maximum 6', () => {
    expect(generate(mulberry32(1), dial(100)).code.length).toBe(6);
  });

  it('clamps guess budget to maximum 10', () => {
    expect(generate(mulberry32(1), dial(-100)).guessBudget).toBe(10);
  });

  it('clamps guess budget to minimum 3', () => {
    expect(generate(mulberry32(1), dial(100)).guessBudget).toBe(3);
  });
});

// ── computeFeedback ───────────────────────────────────────────────────────────

describe('computeFeedback', () => {
  it('exact match gives all rightPlace', () => {
    expect(computeFeedback([1, 2, 3], [1, 2, 3])).toEqual({ rightPlace: 3, rightDigit: 0 });
  });

  it('no overlap gives zeros', () => {
    expect(computeFeedback([1, 2, 3], [4, 5, 6])).toEqual({ rightPlace: 0, rightDigit: 0 });
  });

  it('anagram gives rightDigit not rightPlace', () => {
    expect(computeFeedback([1, 2, 3], [3, 1, 2])).toEqual({ rightPlace: 0, rightDigit: 3 });
  });

  it('partial match', () => {
    expect(computeFeedback([1, 2, 3, 4], [1, 3, 2, 9])).toEqual({ rightPlace: 1, rightDigit: 2 });
  });

  it('does not double-count duplicate guesses against a single code digit', () => {
    expect(computeFeedback([1, 2, 3, 4], [1, 1, 1, 1])).toEqual({ rightPlace: 1, rightDigit: 0 });
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<SafeCrackState> = {}): SafeCrackState {
  return {
    guesses: [],
    guessesRemaining: 3,
    solved: false,
    techBoostUsed: false,
    stealthBoostUsed: false,
    ...overrides,
  };
}

describe('judge', () => {
  it('botched when not solved (guesses exhausted)', () => {
    expect(judge(makeState({ solved: false, guessesRemaining: 0 }))).toBe('botched');
  });

  it('botched when guesses remain but not solved', () => {
    expect(judge(makeState({ solved: false, guessesRemaining: 2 }))).toBe('botched');
  });

  it('complication when solved on the last guess', () => {
    expect(judge(makeState({ solved: true, guessesRemaining: 0 }))).toBe('complication');
  });

  it('clean when solved with guesses to spare', () => {
    expect(judge(makeState({ solved: true, guessesRemaining: 2 }))).toBe('clean');
  });
});

// ── boost hooks — pure apply ──────────────────────────────────────────────────

describe('techBoost (Stethoscope)', () => {
  it('has lane tech', () => {
    expect(techBoost.lane).toBe('tech');
  });

  it('has label Stethoscope', () => {
    expect(techBoost.label).toBe('Stethoscope');
  });

  it('sets techBoostUsed and stethoscopeReveal on first use', () => {
    const params = { code: [3, 7, 1], guessBudget: 5, timerSeconds: 120 };
    const state = makeState();
    const next = techBoost.apply(state, params);
    expect(next.techBoostUsed).toBe(true);
    expect(next.stethoscopeReveal).toEqual({ position: 0, digit: 3 });
  });

  it('is idempotent — same reference returned when already used', () => {
    const params = { code: [3, 7, 1], guessBudget: 5, timerSeconds: 120 };
    const state = makeState({ techBoostUsed: true, stethoscopeReveal: { position: 0, digit: 3 } });
    const next = techBoost.apply(state, params);
    expect(next).toBe(state);
  });

  it('reveals the first unconfirmed position, skipping already-confirmed ones', () => {
    const params = { code: [3, 7, 1], guessBudget: 5, timerSeconds: 120 };
    const state = makeState({
      guesses: [{ guess: [3, 5, 5], rightPlace: 1, rightDigit: 0 }],
    });
    const next = techBoost.apply(state, params);
    expect(next.stethoscopeReveal).toEqual({ position: 1, digit: 7 });
  });

  it('does not mutate the input state', () => {
    const params = { code: [3, 7, 1], guessBudget: 5, timerSeconds: 120 };
    const state = makeState();
    const before = { ...state };
    techBoost.apply(state, params);
    expect(state).toEqual(before);
  });
});

describe('stealthBoost (Patient Touch)', () => {
  it('has lane stealth', () => {
    expect(stealthBoost.lane).toBe('stealth');
  });

  it('has label Patient Touch', () => {
    expect(stealthBoost.label).toBe('Patient Touch');
  });

  it('adds one extra guess on first use', () => {
    const params = { code: [3, 7, 1], guessBudget: 5, timerSeconds: 120 };
    const state = makeState({ guessesRemaining: 2 });
    const next = stealthBoost.apply(state, params);
    expect(next.stealthBoostUsed).toBe(true);
    expect(next.guessesRemaining).toBe(3);
  });

  it('is idempotent — same reference returned when already used', () => {
    const params = { code: [3, 7, 1], guessBudget: 5, timerSeconds: 120 };
    const state = makeState({ stealthBoostUsed: true, guessesRemaining: 3 });
    const next = stealthBoost.apply(state, params);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const params = { code: [3, 7, 1], guessBudget: 5, timerSeconds: 120 };
    const state = makeState({ guessesRemaining: 2 });
    const before = { ...state };
    stealthBoost.apply(state, params);
    expect(state).toEqual(before);
  });
});
