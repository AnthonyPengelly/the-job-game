import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, computeFeedback, techBoost } from './judge';
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

  it('has one boost hook (Stethoscope)', () => {
    expect(safeCrack.boosts).toHaveLength(1);
    expect(safeCrack.boosts[0]!.label).toBe('Stethoscope');
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

  it('clamps digit count to maximum 4 — bigger codes are unwinnable in budget', () => {
    expect(generate(mulberry32(1), dial(100)).code.length).toBe(4);
  });

  it('clamps guess budget to maximum 12 (wave 4: budget doubled)', () => {
    expect(generate(mulberry32(1), dial(-100)).guessBudget).toBe(12);
  });

  it('clamps guess budget to the winnability floor (digits + 2) at a brutal dial', () => {
    const p = generate(mulberry32(1), dial(100));
    expect(p.guessBudget).toBe(p.code.length + 2);
  });

  it('never produces a 4-digit code with fewer than 6 guesses (winnability floor)', () => {
    for (const level of [-3, -1, 0, 0.5, 1, 1.5, 2, 3, 5, 100]) {
      const p = generate(mulberry32(7), dial(level));
      expect(p.guessBudget).toBeGreaterThanOrEqual(p.code.length + 2);
    }
  });
});

// ── Digit pool (playtest wave 2: smaller pool than Mastermind) ────────────────

describe('generate — digit pool', () => {
  it('3-digit codes draw only from 1–4', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = generate(mulberry32(seed), dial(-1));
      expect(p.code.length).toBe(3);
      expect(p.digitMin).toBe(1);
      expect(p.digitMax).toBe(4);
      for (const d of p.code) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(4);
      }
    }
  });

  it('4-digit codes draw only from 1–5', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = generate(mulberry32(seed), dial(3));
      expect(p.code.length).toBe(4);
      expect(p.digitMin).toBe(1);
      expect(p.digitMax).toBe(5);
      for (const d of p.code) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(5);
      }
    }
  });

  it('never produces a zero digit (the pool starts at 1)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generate(mulberry32(seed), dial(seed % 4));
      expect(p.code.every(d => d >= 1)).toBe(true);
    }
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
    const params = { code: [3, 4, 1], digitMin: 1, digitMax: 4, guessBudget: 5, timerSeconds: 120 };
    const state = makeState();
    const next = techBoost.apply(state, params);
    expect(next.techBoostUsed).toBe(true);
    expect(next.stethoscopeReveal).toEqual({ position: 0, digit: 3 });
  });

  it('is idempotent — same reference returned when already used', () => {
    const params = { code: [3, 4, 1], digitMin: 1, digitMax: 4, guessBudget: 5, timerSeconds: 120 };
    const state = makeState({ techBoostUsed: true, stethoscopeReveal: { position: 0, digit: 3 } });
    const next = techBoost.apply(state, params);
    expect(next).toBe(state);
  });

  it('reveals the first unconfirmed position, skipping already-confirmed ones', () => {
    const params = { code: [3, 4, 1], digitMin: 1, digitMax: 4, guessBudget: 5, timerSeconds: 120 };
    const state = makeState({
      guesses: [{ guess: [3, 2, 2], rightPlace: 1, rightDigit: 0 }],
    });
    const next = techBoost.apply(state, params);
    expect(next.stethoscopeReveal).toEqual({ position: 1, digit: 4 });
  });

  it('does not mutate the input state', () => {
    const params = { code: [3, 4, 1], digitMin: 1, digitMax: 4, guessBudget: 5, timerSeconds: 120 };
    const state = makeState();
    const before = { ...state };
    techBoost.apply(state, params);
    expect(state).toEqual(before);
  });
});
