import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, hunchBoost } from './judge';
import type { OnceOverState } from './judge';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { theOnceOver } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('theOnceOver registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('theOnceOver')).toBe(theOnceOver);
  });

  it('has id theOnceOver', () => {
    expect(theOnceOver.id).toBe('theOnceOver');
  });

  it('has lane stealth', () => {
    expect(theOnceOver.lanes).toEqual(['stealth']);
  });

  it('has minCommit 1', () => {
    expect(theOnceOver.minCommit).toBe(1);
  });

  it('has no soloVariantId', () => {
    expect(theOnceOver.soloVariantId).toBeUndefined();
  });

  it('has one boost hook', () => {
    expect(theOnceOver.boosts).toHaveLength(1);
  });
});

// ── Generator reproducibility ─────────────────────────────────────────────────

describe('generate — reproducibility', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    const p1 = generate(mulberry32(42), d);
    const p2 = generate(mulberry32(42), d);
    expect(p1).toEqual(p2);
  });

  it('different seeds produce different changes', () => {
    const p1 = generate(mulberry32(1), dial(0));
    const p2 = generate(mulberry32(9999), dial(0));
    expect(p1.changedCardIds).not.toEqual(p2.changedCardIds);
  });

  it('originalCards is 8–10 cards', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generate(mulberry32(seed), dial(0));
      expect(p.originalCards.length).toBeGreaterThanOrEqual(8);
      expect(p.originalCards.length).toBeLessThanOrEqual(10);
    }
  });

  it('modifiedCards has the same length as originalCards', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.modifiedCards.length).toBe(p.originalCards.length);
  });

  it('all original card IDs are unique', () => {
    const p = generate(mulberry32(42), dial(0));
    const ids = p.originalCards.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('changedCardIds are non-empty', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.changedCardIds.length).toBeGreaterThan(0);
  });

  it('changedCardIds are all valid card IDs from originalCards', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generate(mulberry32(seed), dial(0));
      const allIds = new Set(p.originalCards.map(c => c.id));
      for (const id of p.changedCardIds) {
        expect(allIds.has(id)).toBe(true);
      }
    }
  });

  it('modifiedCards contains at least one card with a different label compared to original', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generate(mulberry32(seed), dial(0));
      let found = false;
      for (let i = 0; i < p.originalCards.length; i++) {
        if (p.originalCards[i]!.label !== p.modifiedCards[i]!.label) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ less study time', () => {
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.studySeconds).toBeLessThanOrEqual(easy.studySeconds);
  });

  it('higher dial ⇒ more changes', () => {
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.changeCount).toBeGreaterThanOrEqual(easy.changeCount);
  });

  it('studySeconds is always within [15, 30]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.studySeconds).toBeGreaterThanOrEqual(15);
      expect(p.studySeconds).toBeLessThanOrEqual(30);
    }
  });

  it('changeCount is always within [1, 3]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.changeCount).toBeGreaterThanOrEqual(1);
      expect(p.changeCount).toBeLessThanOrEqual(3);
    }
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<OnceOverState> = {}): OnceOverState {
  return {
    flaggedCardIds: [],
    studyTimerExpired: false,
    stealthBoostUsed: false,
    hunchActive: false,
    ...overrides,
  };
}

const baseParams = generate(mulberry32(42), dial(0));

describe('judge — three tier boundaries', () => {
  it('botched when no card is flagged', () => {
    expect(judge(makeState({ flaggedCardIds: [] }), baseParams)).toBe('botched');
  });

  it('botched when only wrong cards are flagged', () => {
    const wrongId = baseParams.originalCards
      .map(c => c.id)
      .find(id => !baseParams.changedCardIds.includes(id));
    expect(wrongId).toBeDefined();
    expect(judge(makeState({ flaggedCardIds: [wrongId as CardId] }), baseParams)).toBe('botched');
  });

  it('clean when all changed cards are correctly flagged', () => {
    expect(judge(makeState({ flaggedCardIds: [...baseParams.changedCardIds] }), baseParams)).toBe('clean');
  });

  it('complication when only some changed cards are flagged (one of several)', () => {
    // Only applicable when changeCount > 1 and multiple changedCardIds.
    // Use a generated params with multiple changes.
    const multiParams = generate(mulberry32(42), dial(2)); // higher dial = more changes
    // If multiple changedCardIds exist, flag only the first one.
    if (multiParams.changedCardIds.length > 1) {
      const partialFlag = [multiParams.changedCardIds[0]!];
      expect(judge(makeState({ flaggedCardIds: partialFlag }), multiParams)).toBe('complication');
    } else {
      // Single change case — just verify clean still works.
      expect(judge(makeState({ flaggedCardIds: multiParams.changedCardIds }), multiParams)).toBe('clean');
    }
  });
});

// ── hunch boost — pure apply ──────────────────────────────────────────────────

describe('hunchBoost (Hunch)', () => {
  it('has lane stealth', () => {
    expect(hunchBoost.lane).toBe('stealth');
  });

  it('has label Hunch', () => {
    expect(hunchBoost.label).toBe('Hunch');
  });

  it('sets stealthBoostUsed and hunchActive on first use', () => {
    const state = makeState();
    const next = hunchBoost.apply(state, baseParams);
    expect(next.stealthBoostUsed).toBe(true);
    expect(next.hunchActive).toBe(true);
  });

  it('is idempotent — same reference returned when already used', () => {
    const state = makeState({ stealthBoostUsed: true, hunchActive: true });
    const next = hunchBoost.apply(state, baseParams);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    hunchBoost.apply(state, baseParams);
    expect(JSON.stringify(state)).toBe(before);
  });
});
