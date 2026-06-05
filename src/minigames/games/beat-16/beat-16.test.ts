import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, inTheBonesBoost } from './judge';
import type { Beat16State } from './judge';
import { beat16 } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('beat16 registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('beat16')).toBe(beat16);
  });

  it('has id beat16', () => {
    expect(beat16.id).toBe('beat16');
  });

  it('has lane physical', () => {
    expect(beat16.lanes).toEqual(['physical']);
  });

  it('has minCommit 1', () => {
    expect(beat16.minCommit).toBe(1);
  });

  it('has no soloVariantId', () => {
    expect(beat16.soloVariantId).toBeUndefined();
  });

  it('has one boost hook', () => {
    expect(beat16.boosts).toHaveLength(1);
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

  it('different dials produce different params', () => {
    const p1 = generate(mulberry32(42), dial(-2));
    const p2 = generate(mulberry32(42), dial(2));
    expect(p1.targetBeat).not.toEqual(p2.targetBeat);
  });

  it('cleanWindowMs is always less than complicationWindowMs', () => {
    const p = generate(mulberry32(7), dial(0));
    expect(p.cleanWindowMs).toBeLessThan(p.complicationWindowMs);
  });

  it('audibleBeats is at least 1', () => {
    for (const level of [-5, -1, 0, 1, 5]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.audibleBeats).toBeGreaterThanOrEqual(1);
    }
  });

  it('audibleBeats is always less than targetBeat', () => {
    for (const level of [-2, 0, 2]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.audibleBeats).toBeLessThan(p.targetBeat);
    }
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ more target beats (harder to count)', () => {
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.targetBeat).toBeGreaterThanOrEqual(easy.targetBeat);
  });

  it('higher dial ⇒ faster tempo (harder to track)', () => {
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.bpm).toBeGreaterThanOrEqual(easy.bpm);
  });

  it('targetBeat is always within [8, 20]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.targetBeat).toBeGreaterThanOrEqual(8);
      expect(p.targetBeat).toBeLessThanOrEqual(20);
    }
  });

  it('bpm is always within [60, 120]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.bpm).toBeGreaterThanOrEqual(60);
      expect(p.bpm).toBeLessThanOrEqual(120);
    }
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<Beat16State> = {}): Beat16State {
  return {
    tapTimestampMs: null,
    measuredDeltaMs: null,
    boostUsed: false,
    ...overrides,
  };
}

describe('judge', () => {
  const params = generate(mulberry32(1), dial(0));

  it('botched when no tap (measuredDeltaMs null)', () => {
    expect(judge(makeState(), params)).toBe('botched');
  });

  it('clean when tap is within clean window', () => {
    expect(judge(makeState({ tapTimestampMs: 1, measuredDeltaMs: 0 }), params)).toBe('clean');
    expect(judge(makeState({ tapTimestampMs: 1, measuredDeltaMs: params.cleanWindowMs }), params)).toBe('clean');
    expect(judge(makeState({ tapTimestampMs: 1, measuredDeltaMs: -params.cleanWindowMs }), params)).toBe('clean');
  });

  it('complication when tap is within complication window but outside clean window', () => {
    const delta = params.cleanWindowMs + 50;
    expect(judge(makeState({ tapTimestampMs: 1, measuredDeltaMs: delta }), params)).toBe('complication');
    expect(judge(makeState({ tapTimestampMs: 1, measuredDeltaMs: -delta }), params)).toBe('complication');
  });

  it('complication at the outer edge of the complication window', () => {
    expect(
      judge(makeState({ tapTimestampMs: 1, measuredDeltaMs: params.complicationWindowMs }), params),
    ).toBe('complication');
  });

  it('botched when tap is outside the complication window', () => {
    const delta = params.complicationWindowMs + 1;
    expect(judge(makeState({ tapTimestampMs: 1, measuredDeltaMs: delta }), params)).toBe('botched');
    expect(judge(makeState({ tapTimestampMs: 1, measuredDeltaMs: -delta }), params)).toBe('botched');
  });
});

// ── boost hooks ───────────────────────────────────────────────────────────────

describe('inTheBonesBoost', () => {
  it('has lane physical', () => {
    expect(inTheBonesBoost.lane).toBe('physical');
  });

  it('has label In the Bones', () => {
    expect(inTheBonesBoost.label).toBe('In the Bones');
  });

  it('sets boostUsed to true on first use', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState();
    const next = inTheBonesBoost.apply(state, params);
    expect(next.boostUsed).toBe(true);
  });

  it('is idempotent when already used', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState({ boostUsed: true });
    const next = inTheBonesBoost.apply(state, params);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState();
    const before = JSON.stringify(state);
    inTheBonesBoost.apply(state, params);
    expect(JSON.stringify(state)).toBe(before);
  });
});
