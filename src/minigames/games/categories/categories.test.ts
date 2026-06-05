import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, skipBoost } from './judge';
import type { CategoriesState } from './judge';
import { categories } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('categories registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('categories')).toBe(categories);
  });

  it('has id categories', () => {
    expect(categories.id).toBe('categories');
  });

  it('has lane charm', () => {
    expect(categories.lanes).toEqual(['charm']);
  });

  it('has minCommit 1', () => {
    expect(categories.minCommit).toBe(1);
  });

  it('has no soloVariantId', () => {
    expect(categories.soloVariantId).toBeUndefined();
  });

  it('has one boost hook', () => {
    expect(categories.boosts).toHaveLength(1);
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

  it('different seeds produce different categories', () => {
    const p1 = generate(mulberry32(1), dial(0));
    const p2 = generate(mulberry32(9999), dial(0));
    expect(p1.category).not.toEqual(p2.category);
  });

  it('category is a non-empty string from the bank', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(typeof p.category).toBe('string');
    expect(p.category.length).toBeGreaterThan(0);
  });

  it('skipCategory is a non-empty string from the bank', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(typeof p.skipCategory).toBe('string');
    expect(p.skipCategory.length).toBeGreaterThan(0);
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ higher target count', () => {
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.targetCount).toBeGreaterThanOrEqual(easy.targetCount);
  });

  it('higher dial ⇒ less time', () => {
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('targetCount is always within [4, 12]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.targetCount).toBeGreaterThanOrEqual(4);
      expect(p.targetCount).toBeLessThanOrEqual(12);
    }
  });

  it('timerSeconds is always within [30, 90]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.timerSeconds).toBeGreaterThanOrEqual(30);
      expect(p.timerSeconds).toBeLessThanOrEqual(90);
    }
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<CategoriesState> = {}): CategoriesState {
  return {
    tally: 0,
    timerExpired: false,
    charmBoostUsed: false,
    skipped: false,
    ...overrides,
  };
}

const baseParams = { category: 'Things made of gold', skipCategory: 'Types of cheese', targetCount: 8, timerSeconds: 60 };

describe('judge', () => {
  it('botched when tally is below target regardless of timer', () => {
    expect(judge(makeState({ tally: 5 }), baseParams)).toBe('botched');
    expect(judge(makeState({ tally: 7 }), baseParams)).toBe('botched');
    expect(judge(makeState({ tally: 0 }), baseParams)).toBe('botched');
  });

  it('botched when tally is below target and timer expired', () => {
    expect(judge(makeState({ tally: 5, timerExpired: true }), baseParams)).toBe('botched');
  });

  it('clean when tally reaches target and timer has not expired', () => {
    expect(judge(makeState({ tally: 8 }), baseParams)).toBe('clean');
    expect(judge(makeState({ tally: 10 }), baseParams)).toBe('clean');
  });

  it('complication when tally reaches target and timer expired (at the buzzer)', () => {
    expect(judge(makeState({ tally: 8, timerExpired: true }), baseParams)).toBe('complication');
    expect(judge(makeState({ tally: 12, timerExpired: true }), baseParams)).toBe('complication');
  });
});

// ── boost hooks ───────────────────────────────────────────────────────────────

describe('skipBoost', () => {
  it('has lane charm', () => {
    expect(skipBoost.lane).toBe('charm');
  });

  it('has label Skip', () => {
    expect(skipBoost.label).toBe('Skip');
  });

  it('sets charmBoostUsed and skipped to true on first use', () => {
    const state = makeState({ tally: 3 });
    const next = skipBoost.apply(state, baseParams);
    expect(next.charmBoostUsed).toBe(true);
    expect(next.skipped).toBe(true);
  });

  it('resets the tally to 0 when skipping (new category, fresh start)', () => {
    const state = makeState({ tally: 5 });
    const next = skipBoost.apply(state, baseParams);
    expect(next.tally).toBe(0);
  });

  it('is idempotent — same reference returned when already used', () => {
    const state = makeState({ charmBoostUsed: true, skipped: true });
    const next = skipBoost.apply(state, baseParams);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = makeState({ tally: 3 });
    const before = JSON.stringify(state);
    skipBoost.apply(state, baseParams);
    expect(JSON.stringify(state)).toBe(before);
  });
});
