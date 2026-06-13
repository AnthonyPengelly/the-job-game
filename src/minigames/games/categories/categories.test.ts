import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { makeGenerate } from './generate';
import { judge, skipBoost } from './judge';
import type { CategoriesState } from './judge';
import { makeCategories } from './index';
import { loadPreset } from '@/platform/presets/load';
import { buildRegistry } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

const TEST_ITEMS = ['Things made of gold', 'Types of cheese', 'European cities', 'Casino games', 'Cocktails'];
const TEST_ITEMS_SINGLE = ['Only item'];

// ── Registry ──────────────────────────────────────────────────────────────────

describe('categories registry', () => {
  it('buildRegistry with default preset contains categories game', () => {
    const cfg = loadPreset('default');
    const registry = buildRegistry(cfg);
    expect(registry.find(g => g.id === 'categories')).toBeDefined();
  });

  it('makeCategories has id categories', () => {
    expect(makeCategories(TEST_ITEMS).id).toBe('categories');
  });

  it('makeCategories has lane charm', () => {
    expect(makeCategories(TEST_ITEMS).lanes).toEqual(['charm']);
  });

  it('makeCategories has minCommit 1', () => {
    expect(makeCategories(TEST_ITEMS).minCommit).toBe(1);
  });

  it('makeCategories has no soloVariantId', () => {
    expect(makeCategories(TEST_ITEMS).soloVariantId).toBeUndefined();
  });

  it('makeCategories has one boost hook', () => {
    expect(makeCategories(TEST_ITEMS).boosts).toHaveLength(1);
  });
});

// ── Generator reproducibility ─────────────────────────────────────────────────

describe('generate — reproducibility', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    const generate = makeGenerate(TEST_ITEMS);
    const p1 = generate(mulberry32(1312), d);
    const p2 = generate(mulberry32(1312), d);
    expect(p1).toEqual(p2);
  });

  it('different seeds produce different categories', () => {
    const generate = makeGenerate(TEST_ITEMS);
    const p1 = generate(mulberry32(1), dial(0));
    const p2 = generate(mulberry32(9999), dial(0));
    expect(p1.category).not.toEqual(p2.category);
  });

  it('category is a non-empty string from the bank', () => {
    const p = makeGenerate(TEST_ITEMS)(mulberry32(42), dial(0));
    expect(typeof p.category).toBe('string');
    expect(p.category.length).toBeGreaterThan(0);
  });

  it('skipCategory is a non-empty string from the bank', () => {
    const p = makeGenerate(TEST_ITEMS)(mulberry32(42), dial(0));
    expect(typeof p.skipCategory).toBe('string');
    expect(p.skipCategory.length).toBeGreaterThan(0);
  });

  it('skipCategory differs from category when the bank has more than one item', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = makeGenerate(TEST_ITEMS)(mulberry32(seed), dial(0));
      expect(p.skipCategory).not.toEqual(p.category);
    }
  });

  it('does not infinite-loop when bank has a single item', () => {
    const p = makeGenerate(TEST_ITEMS_SINGLE)(mulberry32(1), dial(0));
    expect(p.category).toBe('Only item');
    expect(p.skipCategory).toBe('Only item');
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ higher target count', () => {
    const easy = makeGenerate(TEST_ITEMS)(mulberry32(42), dial(-2));
    const hard = makeGenerate(TEST_ITEMS)(mulberry32(42), dial(2));
    expect(hard.targetCount).toBeGreaterThanOrEqual(easy.targetCount);
  });

  it('higher dial ⇒ less time', () => {
    const easy = makeGenerate(TEST_ITEMS)(mulberry32(42), dial(-2));
    const hard = makeGenerate(TEST_ITEMS)(mulberry32(42), dial(2));
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('targetCount is always within [6, 14] (wave 4: +2)', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = makeGenerate(TEST_ITEMS)(mulberry32(1), dial(level));
      expect(p.targetCount).toBeGreaterThanOrEqual(6);
      expect(p.targetCount).toBeLessThanOrEqual(14);
    }
  });

  it('timerSeconds is always within [30, 90]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = makeGenerate(TEST_ITEMS)(mulberry32(1), dial(level));
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
  it('clean when tally meets the target (timer not expired)', () => {
    expect(judge(makeState({ tally: 8 }), baseParams)).toBe('clean');
    expect(judge(makeState({ tally: 10 }), baseParams)).toBe('clean');
  });

  it('target met, then timer expires ⇒ clean', () => {
    expect(judge(makeState({ tally: 8, timerExpired: true }), baseParams)).toBe('clean');
    expect(judge(makeState({ tally: 12, timerExpired: true }), baseParams)).toBe('clean');
  });

  it('complication when tally is one short of target (small margin)', () => {
    expect(judge(makeState({ tally: 7 }), baseParams)).toBe('complication');
    expect(judge(makeState({ tally: 7, timerExpired: true }), baseParams)).toBe('complication');
  });

  it('botched when tally misses by more than one', () => {
    expect(judge(makeState({ tally: 5 }), baseParams)).toBe('botched');
    expect(judge(makeState({ tally: 0 }), baseParams)).toBe('botched');
    expect(judge(makeState({ tally: 5, timerExpired: true }), baseParams)).toBe('botched');
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
