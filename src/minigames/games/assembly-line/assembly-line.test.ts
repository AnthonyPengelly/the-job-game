import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
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

  it('different seed + same dial ⇒ may differ (RNG is used)', () => {
    const d = dial(0);
    const p1 = generate(mulberry32(1), d);
    const p2 = generate(mulberry32(9999), d);
    expect(p1.handSize).toBe(p2.handSize);
    expect(p1.timerSeconds).toBe(p2.timerSeconds);
  });

  it('handSize is a positive integer', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.handSize).toBeGreaterThan(0);
    expect(Number.isInteger(p.handSize)).toBe(true);
  });

  it('setTypesInPlay is a non-empty array of strings', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.setTypesInPlay.length).toBeGreaterThan(0);
    p.setTypesInPlay.forEach(t => expect(typeof t).toBe('string'));
  });

  it('setTypesInPlay contains no duplicates', () => {
    const p = generate(mulberry32(42), dial(0));
    const unique = new Set(p.setTypesInPlay);
    expect(unique.size).toBe(p.setTypesInPlay.length);
  });

  it('timerSeconds is a positive integer', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.timerSeconds).toBeGreaterThan(0);
    expect(Number.isInteger(p.timerSeconds)).toBe(true);
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ more or equal types in play (harder)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.setTypesInPlay.length).toBeGreaterThanOrEqual(easy.setTypesInPlay.length);
  });

  it('higher dial ⇒ larger or equal hand size (harder)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.handSize).toBeGreaterThanOrEqual(easy.handSize);
  });

  it('higher dial ⇒ less or equal time (harder)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('handSize is always within [3, 7]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.handSize).toBeGreaterThanOrEqual(3);
      expect(p.handSize).toBeLessThanOrEqual(7);
    }
  });

  it('timerSeconds is always within [60, 180]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.timerSeconds).toBeGreaterThanOrEqual(60);
      expect(p.timerSeconds).toBeLessThanOrEqual(180);
    }
  });

  it('setTypesInPlay length is always within [2, 5]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.setTypesInPlay.length).toBeGreaterThanOrEqual(2);
      expect(p.setTypesInPlay.length).toBeLessThanOrEqual(5);
    }
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
