import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, tipOffBoost } from './judge';
import type { AssemblyLineNegotiatedState } from './judge';
import { assemblyLineNegotiated } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('assemblyLineNegotiated registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('assemblyLineNegotiated')).toBe(assemblyLineNegotiated);
  });

  it('has id assemblyLineNegotiated', () => {
    expect(assemblyLineNegotiated.id).toBe('assemblyLineNegotiated');
  });

  it('has lanes physical and charm', () => {
    expect(assemblyLineNegotiated.lanes).toEqual(['physical', 'charm']);
  });

  it('has minCommit 2', () => {
    expect(assemblyLineNegotiated.minCommit).toBe(2);
  });

  it('has no soloVariantId', () => {
    expect(assemblyLineNegotiated.soloVariantId).toBeUndefined();
  });

  it('has one boost hook (Tip-Off)', () => {
    expect(assemblyLineNegotiated.boosts).toHaveLength(1);
    expect(assemblyLineNegotiated.boosts[0]!.label).toBe('Tip-Off');
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

  it('decoys and timer are dial-driven; rank order varies with seed', () => {
    const d = dial(1);
    const p1 = generate(mulberry32(1), d);
    const p2 = generate(mulberry32(9999), d);
    expect(p1.decoysPerPlayer).toBe(p2.decoysPerPlayer);
    expect(p1.timerSeconds).toBe(p2.timerSeconds);
    expect(p1.rankOrder.join()).not.toBe(p2.rankOrder.join());
  });

  it('rankOrder is a permutation of all 13 ranks', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.rankOrder).toHaveLength(13);
    expect(new Set(p.rankOrder).size).toBe(13);
  });

  it('timerSeconds is a positive integer', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.timerSeconds).toBeGreaterThan(0);
    expect(Number.isInteger(p.timerSeconds)).toBe(true);
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ decoys enter the deal', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(easy.decoysPerPlayer).toBe(0);
    expect(hard.decoysPerPlayer).toBe(1);
  });

  it('higher dial ⇒ less or equal time', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('all values within clamped bounds', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect([0, 1]).toContain(p.decoysPerPlayer);
      expect(p.timerSeconds).toBeGreaterThanOrEqual(60);
      expect(p.timerSeconds).toBeLessThanOrEqual(140);
    }
  });
});

// ── judge — three tier boundaries ─────────────────────────────────────────────

function makeState(overrides: Partial<AssemblyLineNegotiatedState> = {}): AssemblyLineNegotiatedState {
  return {
    timerExpired: false,
    setsCompleted: 0,
    targetSets: 2,
    tipOffUsed: false,
    ...overrides,
  };
}

const baseParams = generate(mulberry32(1), dial(0));

describe('judge — three tier boundaries', () => {
  it('complication when game is in progress (default suggestion)', () => {
    expect(judge(makeState())).toBe('complication');
  });

  it('clean when all sets completed with time remaining', () => {
    expect(judge(makeState({ setsCompleted: 2, targetSets: 2 }))).toBe('clean');
  });

  it('clean when all sets completed even if timer also expired (target met trumps timer)', () => {
    expect(judge(makeState({ timerExpired: true, setsCompleted: 2, targetSets: 2 }))).toBe('clean');
  });

  it('complication when all-but-one complete with time remaining', () => {
    expect(judge(makeState({ setsCompleted: 1, targetSets: 2 }))).toBe('complication');
  });

  it('botched when timer expires and sets not complete', () => {
    expect(judge(makeState({ timerExpired: true, setsCompleted: 0, targetSets: 2 }))).toBe('botched');
  });
});

// ── tipOffBoost (Charm) ───────────────────────────────────────────────────────

describe('tipOffBoost (Tip-Off)', () => {
  it('has lane charm', () => {
    expect(tipOffBoost.lane).toBe('charm');
  });

  it('has label Tip-Off', () => {
    expect(tipOffBoost.label).toBe('Tip-Off');
  });

  it('sets tipOffUsed on first use', () => {
    const state = makeState();
    const next = tipOffBoost.apply(state, baseParams);
    expect(next.tipOffUsed).toBe(true);
  });

  it('is idempotent — same reference returned when already used', () => {
    const state = makeState({ tipOffUsed: true });
    const next = tipOffBoost.apply(state, baseParams);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    tipOffBoost.apply(state, baseParams);
    expect(JSON.stringify(state)).toBe(before);
  });
});
