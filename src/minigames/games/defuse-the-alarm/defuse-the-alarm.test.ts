import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import type { DefuseParams } from './generate';
import { judge, clearChannelBoost } from './judge';
import type { DefuseState } from './judge';
import { defuseTheAlarm } from './index';
import { getGame } from '@/minigames/registry';
import type { CardId } from '@/minigames/primitives/CardSpread';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('defuseTheAlarm registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('defuseTheAlarm')).toBe(defuseTheAlarm);
  });

  it('has id defuseTheAlarm', () => {
    expect(defuseTheAlarm.id).toBe('defuseTheAlarm');
  });

  it('has lanes charm and stealth', () => {
    expect(defuseTheAlarm.lanes).toEqual(['charm', 'stealth']);
  });

  it('has minCommit 2 (excluded from solo)', () => {
    expect(defuseTheAlarm.minCommit).toBe(2);
  });

  it('has no soloVariantId (excluded, not variant-served)', () => {
    expect(defuseTheAlarm.soloVariantId).toBeUndefined();
  });

  it('has one boost hook (Clear Channel)', () => {
    expect(defuseTheAlarm.boosts).toHaveLength(1);
    expect(defuseTheAlarm.boosts[0]!.label).toBe('Clear Channel');
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

  it('different seed + same dial ⇒ may differ (RNG drives wire/rule selection)', () => {
    const p1 = generate(mulberry32(1), dial(0));
    const p2 = generate(mulberry32(9999), dial(0));
    expect(p1.timerSeconds).toBe(p2.timerSeconds);
  });

  it('wires array is non-empty', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.wires.length).toBeGreaterThan(0);
  });

  it('cutRules array is non-empty', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.cutRules.length).toBeGreaterThan(0);
  });

  it('safeWireIds is non-empty (at least one safe wire)', () => {
    for (const seed of [1, 42, 100, 999, 12345]) {
      for (const level of [-2, 0, 2]) {
        const p = generate(mulberry32(seed), dial(level));
        expect(p.safeWireIds.length).toBeGreaterThan(0);
      }
    }
  });

  it('all safeWireIds refer to wires that exist in the wires array', () => {
    const p = generate(mulberry32(42), dial(0));
    const wireIds = new Set(p.wires.map(w => w.id));
    for (const id of p.safeWireIds) {
      expect(wireIds.has(id)).toBe(true);
    }
  });

  it('cutRules have no duplicate (property, value) pairs', () => {
    const p = generate(mulberry32(42), dial(0));
    const seen = new Set<string>();
    for (const rule of p.cutRules) {
      const key = `${rule.property}:${rule.value}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('timerSeconds is a positive integer', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.timerSeconds).toBeGreaterThan(0);
    expect(Number.isInteger(p.timerSeconds)).toBe(true);
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ more or equal wires (fewer items at lower dial = easier)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.wires.length).toBeGreaterThanOrEqual(easy.wires.length);
  });

  it('higher dial ⇒ more or equal rules (simpler rulebook at lower dial = easier)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.cutRules.length).toBeGreaterThanOrEqual(easy.cutRules.length);
  });

  it('higher dial ⇒ less or equal timer (more time at lower dial = easier)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('wireCount is always within [4, 10]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.wires.length).toBeGreaterThanOrEqual(4);
      expect(p.wires.length).toBeLessThanOrEqual(10);
    }
  });

  it('ruleCount is always within [1, 4]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.cutRules.length).toBeGreaterThanOrEqual(1);
      expect(p.cutRules.length).toBeLessThanOrEqual(4);
    }
  });

  it('timerSeconds is always within [60, 180]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.timerSeconds).toBeGreaterThanOrEqual(60);
      expect(p.timerSeconds).toBeLessThanOrEqual(180);
    }
  });
});

// ── judge — three tier boundaries ─────────────────────────────────────────────

const baseParams = generate(mulberry32(1), dial(0));

function makeState(overrides: Partial<DefuseState> = {}): DefuseState {
  return {
    cutIds: [],
    timerExpired: false,
    clearChannelUsed: false,
    ...overrides,
  };
}

function allSafeCuts(p: DefuseParams): DefuseState {
  return makeState({ cutIds: [...p.safeWireIds] });
}

function withWrongCut(p: DefuseParams): CardId {
  const unsafe = p.wires.find(w => !p.safeWireIds.includes(w.id));
  if (!unsafe) throw new Error('No unsafe wire in params — test setup issue');
  return unsafe.id;
}

describe('judge — three tier boundaries', () => {
  it('complication when game is in progress (default suggestion)', () => {
    expect(judge(makeState(), baseParams)).toBe('complication');
  });

  it('clean when all safe cuts made, no wrong cut, timer running', () => {
    const state = allSafeCuts(baseParams);
    expect(judge(state, baseParams)).toBe('clean');
  });

  it('clean when all safe cuts made even if timer also expired (target met trumps timer)', () => {
    const state = { ...allSafeCuts(baseParams), timerExpired: true };
    expect(judge(state, baseParams)).toBe('clean');
  });

  it('botched when timer expires before all safe cuts done', () => {
    const state = makeState({ timerExpired: true });
    expect(judge(state, baseParams)).toBe('botched');
  });

  it('botched when any wrong cut is made', () => {
    const wrongId = withWrongCut(baseParams);
    const state = makeState({ cutIds: [wrongId] });
    expect(judge(state, baseParams)).toBe('botched');
  });

  it('still botched if timer also expired with cuts incomplete', () => {
    const state = makeState({ timerExpired: true });
    expect(judge(state, baseParams)).toBe('botched');
  });
});

// ── clearChannelBoost (Charm) ─────────────────────────────────────────────────

describe('clearChannelBoost (Clear Channel)', () => {
  it('has lane charm', () => {
    expect(clearChannelBoost.lane).toBe('charm');
  });

  it('has label Clear Channel', () => {
    expect(clearChannelBoost.label).toBe('Clear Channel');
  });

  it('sets clearChannelUsed on first use', () => {
    const state = makeState();
    const next = clearChannelBoost.apply(state, baseParams);
    expect(next.clearChannelUsed).toBe(true);
  });

  it('is idempotent — same reference returned when already used', () => {
    const state = makeState({ clearChannelUsed: true });
    const next = clearChannelBoost.apply(state, baseParams);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    clearChannelBoost.apply(state, baseParams);
    expect(JSON.stringify(state)).toBe(before);
  });
});
