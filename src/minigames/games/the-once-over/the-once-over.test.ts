import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, hunchBoost } from './judge';
import type { OnceOverState } from './judge';
import { theOnceOver } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('theOnceOver registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('theOnceOver')).toBe(theOnceOver);
  });

  it('has lane stealth', () => {
    expect(theOnceOver.lanes).toEqual(['stealth']);
  });

  it('has minCommit 1', () => {
    expect(theOnceOver.minCommit).toBe(1);
  });

  it('has one boost hook (Hunch)', () => {
    expect(theOnceOver.boosts).toHaveLength(1);
    expect(theOnceOver.boosts[0]!.label).toBe('Hunch');
  });
});

// ── Generator ────────────────────────────────────────────────────────────────

describe('generate — positional change instructions', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    expect(generate(mulberry32(7), d)).toEqual(generate(mulberry32(7), d));
  });

  it('different seeds produce different instructions', () => {
    const a = generate(mulberry32(1), dial(1));
    const b = generate(mulberry32(2), dial(1));
    expect(JSON.stringify(a.changes)).not.toBe(JSON.stringify(b.changes));
  });

  it('cardCount is always 8–10', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = generate(mulberry32(seed), dial(0));
      expect(p.cardCount).toBeGreaterThanOrEqual(8);
      expect(p.cardCount).toBeLessThanOrEqual(10);
    }
  });

  it('every changed position is within the dealt row and used at most once', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = generate(mulberry32(seed), dial(3));
      for (const pos of p.changedPositions) {
        expect(pos).toBeGreaterThanOrEqual(1);
        expect(pos).toBeLessThanOrEqual(p.cardCount);
      }
      expect(new Set(p.changedPositions).size).toBe(p.changedPositions.length);
    }
  });

  it('swap changes carry two positions, replace changes carry one', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = generate(mulberry32(seed), dial(2));
      for (const ch of p.changes) {
        expect(ch.positions).toHaveLength(ch.type === 'swap' ? 2 : 1);
      }
    }
  });

  it('higher dial ⇒ more changes and less study time', () => {
    const easy = generate(mulberry32(5), dial(-2));
    const hard = generate(mulberry32(5), dial(4));
    expect(hard.changeCount).toBeGreaterThanOrEqual(easy.changeCount);
    expect(hard.studySeconds).toBeLessThanOrEqual(easy.studySeconds);
  });

  it('changeCount matches the changes array', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const p = generate(mulberry32(seed), dial(2));
      expect(p.changeCount).toBe(p.changes.length);
    }
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<OnceOverState> = {}): OnceOverState {
  return {
    hits: 0,
    misses: 0,
    studyTimerExpired: true,
    stealthBoostUsed: false,
    hunchActive: false,
    ...overrides,
  };
}

describe('judge', () => {
  const params = generate(mulberry32(3), dial(3)); // multiple changes likely

  it('botched when nothing spotted', () => {
    expect(judge(makeState(), params)).toBe('botched');
  });

  it('botched even with wrong calls recorded', () => {
    expect(judge(makeState({ misses: 3 }), params)).toBe('botched');
  });

  it('clean when every change spotted', () => {
    expect(judge(makeState({ hits: params.changeCount }), params)).toBe('clean');
  });

  it('complication when some but not all changes spotted', () => {
    const p = { ...params, changeCount: 2 };
    expect(judge(makeState({ hits: 1 }), p)).toBe('complication');
  });
});

// ── hunchBoost ────────────────────────────────────────────────────────────────

describe('hunchBoost', () => {
  const params = generate(mulberry32(1), dial(0));

  it('has lane stealth and label Hunch', () => {
    expect(hunchBoost.lane).toBe('stealth');
    expect(hunchBoost.label).toBe('Hunch');
  });

  it('activates hunch on first use', () => {
    const next = hunchBoost.apply(makeState(), params);
    expect(next.stealthBoostUsed).toBe(true);
    expect(next.hunchActive).toBe(true);
  });

  it('is idempotent when already used', () => {
    const state = makeState({ stealthBoostUsed: true });
    expect(hunchBoost.apply(state, params)).toBe(state);
  });
});
