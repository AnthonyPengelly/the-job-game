import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { resolveDeal } from './deal';
import { judge, tipOffBoost } from './judge';
import type { AssemblyLineState } from './judge';
import { assemblyLine } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('assemblyLine registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('assemblyLine')).toBe(assemblyLine);
  });

  it('has id assemblyLine', () => {
    expect(assemblyLine.id).toBe('assemblyLine');
  });

  it('has lanes physical and charm', () => {
    expect(assemblyLine.lanes).toEqual(['physical', 'charm']);
  });

  it('has minCommit 2', () => {
    expect(assemblyLine.minCommit).toBe(2);
  });

  it('has no soloVariantId', () => {
    expect(assemblyLine.soloVariantId).toBeUndefined();
  });

  it('has one boost hook (Tip-Off)', () => {
    expect(assemblyLine.boosts).toHaveLength(1);
    expect(assemblyLine.boosts[0]!.label).toBe('Tip-Off');
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

  it('different seed + same dial ⇒ rank order differs but levers match (RNG shuffles ranks)', () => {
    const d = dial(0);
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
  it('higher dial ⇒ decoys enter the deal (harder)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(easy.decoysPerPlayer).toBe(0);
    expect(hard.decoysPerPlayer).toBe(1);
  });

  it('higher dial ⇒ less or equal time (harder)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('timerSeconds is always within [45, 120] — communication-speed game', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.timerSeconds).toBeGreaterThanOrEqual(45);
      expect(p.timerSeconds).toBeLessThanOrEqual(120);
    }
  });

  it('decoysPerPlayer is only ever 0 or 1', () => {
    for (const level of [-100, -2, 0, 1, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect([0, 1]).toContain(p.decoysPerPlayer);
    }
  });
});

// ── resolveDeal ───────────────────────────────────────────────────────────────

describe('resolveDeal', () => {
  it('assigns one set rank per player, all four of each pulled', () => {
    const p = generate(mulberry32(7), dial(0));
    const deal = resolveDeal(p.rankOrder, p.decoysPerPlayer, 4);
    expect(deal.setRanks).toHaveLength(4);
    expect(deal.handSize).toBe(4);
    expect(deal.totalCards).toBe(16);
    expect(deal.decoyRanks).toHaveLength(0);
  });

  it('adds one decoy per player at high dial, and hand size grows to 5', () => {
    const p = generate(mulberry32(7), dial(2));
    const deal = resolveDeal(p.rankOrder, p.decoysPerPlayer, 3);
    expect(deal.setRanks).toHaveLength(3);
    expect(deal.decoyRanks).toHaveLength(3);
    expect(deal.handSize).toBe(5);
    expect(deal.totalCards).toBe(15);
  });

  it('set ranks and decoy ranks never overlap', () => {
    const p = generate(mulberry32(9), dial(3));
    const deal = resolveDeal(p.rankOrder, p.decoysPerPlayer, 5);
    const overlap = deal.setRanks.filter(r => deal.decoyRanks.includes(r));
    expect(overlap).toHaveLength(0);
  });

  it('deal stays within one standard pack for the full 7-player crew', () => {
    const p = generate(mulberry32(11), dial(5));
    const deal = resolveDeal(p.rankOrder, p.decoysPerPlayer, 7);
    expect(deal.totalCards).toBeLessThanOrEqual(52);
  });
});

// ── judge — three tier boundaries ─────────────────────────────────────────────

function makeState(overrides: Partial<AssemblyLineState> = {}): AssemblyLineState {
  return {
    timerExpired: false,
    setsCompleted: 0,
    targetSets: 2,
    tipOffUsed: false,
    ...overrides,
  };
}

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

  it('botched when timer expired even if all-but-one done', () => {
    expect(judge(makeState({ timerExpired: true, setsCompleted: 1, targetSets: 2 }))).toBe('botched');
  });
});

// ── tipOffBoost (Charm) ───────────────────────────────────────────────────────

const baseParams = generate(mulberry32(1), dial(0));

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
