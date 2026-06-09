import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, extraHandsBoost } from './judge';
import type { SteadyHandsState } from './judge';
import { steadyHands } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('steadyHands registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('steadyHands')).toBe(steadyHands);
  });

  it('has id steadyHands', () => {
    expect(steadyHands.id).toBe('steadyHands');
  });

  it('has lanes physical and stealth', () => {
    expect(steadyHands.lanes).toEqual(['physical', 'stealth']);
  });

  it('has minCommit 1', () => {
    expect(steadyHands.minCommit).toBe(1);
  });

  it('has no soloVariantId', () => {
    expect(steadyHands.soloVariantId).toBeUndefined();
  });

  it('has one boost hook (Extra Hands)', () => {
    expect(steadyHands.boosts).toHaveLength(1);
    expect(steadyHands.boosts[0]!.label).toBe('Extra Hands');
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

  it('same dial always gives same params regardless of seed (pure-skill)', () => {
    const d = dial(1);
    const p1 = generate(mulberry32(1), d);
    const p2 = generate(mulberry32(9999), d);
    expect(p1).toEqual(p2);
  });

  it('targetHeight and timerSeconds are positive numbers', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.targetHeight).toBeGreaterThan(0);
    expect(p.timerSeconds).toBeGreaterThan(0);
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ taller target (harder)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.targetHeight).toBeGreaterThanOrEqual(easy.targetHeight);
  });

  it('higher dial ⇒ less timer time (harder)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('targetHeight is always within [3, 9]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.targetHeight).toBeGreaterThanOrEqual(3);
      expect(p.targetHeight).toBeLessThanOrEqual(9);
    }
  });

  it('timerSeconds is always within [45, 120]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.timerSeconds).toBeGreaterThanOrEqual(45);
      expect(p.timerSeconds).toBeLessThanOrEqual(120);
    }
  });
});

// ── judge — three tier boundaries ─────────────────────────────────────────────

function makeState(overrides: Partial<SteadyHandsState> = {}): SteadyHandsState {
  return {
    timerExpired: false,
    extraHandsUsed: false,
    extraHandsActive: false,
    ...overrides,
  };
}

describe('judge — three tier boundaries', () => {
  it('complication when game is in progress (default suggestion)', () => {
    expect(judge(makeState())).toBe('complication');
  });

  it('botched when timer expires', () => {
    expect(judge(makeState({ timerExpired: true }))).toBe('botched');
  });
});

// ── extraHandsBoost (Physical) ────────────────────────────────────────────────

const baseParams = generate(mulberry32(1), dial(0));

describe('extraHandsBoost (Extra Hands)', () => {
  it('has lane physical', () => {
    expect(extraHandsBoost.lane).toBe('physical');
  });

  it('has label Extra Hands', () => {
    expect(extraHandsBoost.label).toBe('Extra Hands');
  });

  it('sets extraHandsUsed and extraHandsActive on first use', () => {
    const state = makeState();
    const next = extraHandsBoost.apply(state, baseParams);
    expect(next.extraHandsUsed).toBe(true);
    expect(next.extraHandsActive).toBe(true);
  });

  it('is idempotent — same reference returned when already used', () => {
    const state = makeState({ extraHandsUsed: true, extraHandsActive: false });
    const next = extraHandsBoost.apply(state, baseParams);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    extraHandsBoost.apply(state, baseParams);
    expect(JSON.stringify(state)).toBe(before);
  });
});
