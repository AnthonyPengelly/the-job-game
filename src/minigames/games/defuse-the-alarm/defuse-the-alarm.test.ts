import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, clearChannelBoost } from './judge';
import type { DefuseState } from './judge';
import { defuseTheAlarm } from './index';
import { getGame } from '@/minigames/registry';

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

// ── Generator ────────────────────────────────────────────────────────────────

describe('generate — property rules over a physical deal', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    expect(generate(mulberry32(7), d)).toEqual(generate(mulberry32(7), d));
  });

  it('different seed + same dial ⇒ rules may differ (RNG draws the rulebook)', () => {
    const d = dial(2);
    const a = generate(mulberry32(1), d);
    const b = generate(mulberry32(987), d);
    expect(a.wireCount).toBe(b.wireCount);
    expect(a.timerSeconds).toBe(b.timerSeconds);
    // rule draw is seed-dependent; ids must always be unique within a rulebook
    expect(new Set(a.cutRules.map(r => r.id)).size).toBe(a.cutRules.length);
  });

  it('cutRules is non-empty and every rule has display text', () => {
    const p = generate(mulberry32(42), dial(0));
    expect(p.cutRules.length).toBeGreaterThan(0);
    p.cutRules.forEach(r => expect(r.text.length).toBeGreaterThan(0));
  });

  it('never draws both colour rules (everything-safe rulebooks are degenerate)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = generate(mulberry32(seed), dial(4)); // max rules
      const colours = p.cutRules.filter(r => r.kind === 'color');
      expect(colours.length).toBeLessThanOrEqual(1);
    }
  });

  it('never draws both value-band rules', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = generate(mulberry32(seed), dial(4));
      const bands = p.cutRules.filter(r => r.kind === 'low' || r.kind === 'high');
      expect(bands.length).toBeLessThanOrEqual(1);
    }
  });

  it('higher dial ⇒ more or equal wires, rules; less or equal time', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(3));
    expect(hard.wireCount).toBeGreaterThanOrEqual(easy.wireCount);
    expect(hard.cutRules.length).toBeGreaterThanOrEqual(easy.cutRules.length);
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('wireCount stays within a dealable range [4, 8]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.wireCount).toBeGreaterThanOrEqual(4);
      expect(p.wireCount).toBeLessThanOrEqual(8);
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

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<DefuseState> = {}): DefuseState {
  return {
    safeCuts: 0,
    wrongCut: false,
    allClear: false,
    timerExpired: false,
    clearChannelUsed: false,
    ...overrides,
  };
}

describe('judge — three tier boundaries', () => {
  it('complication when game is in progress (default suggestion)', () => {
    expect(judge(makeState({ safeCuts: 2 }))).toBe('complication');
  });

  it('clean when GM declares all clear with no wrong cut', () => {
    expect(judge(makeState({ safeCuts: 3, allClear: true }))).toBe('clean');
  });

  it('clean when all clear even if timer also expired (target met trumps timer)', () => {
    expect(judge(makeState({ allClear: true, timerExpired: true }))).toBe('clean');
  });

  it('botched when timer expires before all clear', () => {
    expect(judge(makeState({ safeCuts: 1, timerExpired: true }))).toBe('botched');
  });

  it('botched when any wrong cut is recorded', () => {
    expect(judge(makeState({ safeCuts: 4, wrongCut: true, allClear: true }))).toBe('botched');
  });
});

// ── clearChannelBoost ─────────────────────────────────────────────────────────

describe('clearChannelBoost (Clear Channel)', () => {
  const params = generate(mulberry32(1), dial(0));

  it('has lane charm and label Clear Channel', () => {
    expect(clearChannelBoost.lane).toBe('charm');
    expect(clearChannelBoost.label).toBe('Clear Channel');
  });

  it('sets clearChannelUsed on first use', () => {
    const next = clearChannelBoost.apply(makeState(), params);
    expect(next.clearChannelUsed).toBe(true);
  });

  it('is idempotent when already used', () => {
    const state = makeState({ clearChannelUsed: true });
    expect(clearChannelBoost.apply(state, params)).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    clearChannelBoost.apply(state, params);
    expect(JSON.stringify(state)).toBe(before);
  });
});
