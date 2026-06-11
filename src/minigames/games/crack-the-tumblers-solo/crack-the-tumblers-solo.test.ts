import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, resetPinBoost } from './judge';
import type { CrackTheTumblersSoloState } from './judge';
import { crackTheTumblersSolo } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('crackTheTumblersSolo registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('crackTheTumblersSolo')).toBe(crackTheTumblersSolo);
  });

  it('has id crackTheTumblersSolo', () => {
    expect(crackTheTumblersSolo.id).toBe('crackTheTumblersSolo');
  });

  it('has lane tech', () => {
    expect(crackTheTumblersSolo.lanes).toEqual(['tech']);
  });

  it('has minCommit 1', () => {
    expect(crackTheTumblersSolo.minCommit).toBe(1);
  });

  it('has one boost hook', () => {
    expect(crackTheTumblersSolo.boosts).toHaveLength(1);
  });
});

// ── Generator ────────────────────────────────────────────────────────────────

describe('generate — physical memory parameters', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    expect(generate(mulberry32(1312), d)).toEqual(generate(mulberry32(1312), d));
  });

  it('same dial gives same params regardless of seed (deal randomness is physical)', () => {
    const d = dial(1);
    expect(generate(mulberry32(1), d)).toEqual(generate(mulberry32(9999), d));
  });

  it('higher dial ⇒ more cards to memorise', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.cardCount).toBeGreaterThanOrEqual(easy.cardCount);
  });

  it('higher dial ⇒ less study time', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.studySeconds).toBeLessThanOrEqual(easy.studySeconds);
  });

  it('cardCount stays within [4, 8]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.cardCount).toBeGreaterThanOrEqual(4);
      expect(p.cardCount).toBeLessThanOrEqual(8);
    }
  });

  it('studySeconds stays within [6, 25]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.studySeconds).toBeGreaterThanOrEqual(6);
      expect(p.studySeconds).toBeLessThanOrEqual(25);
    }
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<CrackTheTumblersSoloState> = {}): CrackTheTumblersSoloState {
  return {
    phase: 'recall',
    flipsRecorded: 0,
    alarmTripped: false,
    resetPinUsed: false,
    ...overrides,
  };
}

const params = generate(mulberry32(1), dial(0));

describe('judge', () => {
  it('botched when alarmTripped', () => {
    expect(judge(makeState({ alarmTripped: true, flipsRecorded: params.cardCount }), params)).toBe('botched');
  });

  it('botched when row incomplete', () => {
    expect(judge(makeState({ flipsRecorded: params.cardCount - 1 }), params)).toBe('botched');
  });

  it('clean when full row flipped in order', () => {
    expect(judge(makeState({ flipsRecorded: params.cardCount }), params)).toBe('clean');
  });

  it('complication when completed but Reset Pin was used', () => {
    expect(
      judge(makeState({ flipsRecorded: params.cardCount, resetPinUsed: true }), params),
    ).toBe('complication');
  });
});

// ── resetPinBoost ─────────────────────────────────────────────────────────────

describe('resetPinBoost (solo)', () => {
  it('has lane tech', () => {
    expect(resetPinBoost.lane).toBe('tech');
  });

  it('has label Reset Pin', () => {
    expect(resetPinBoost.label).toBe('Reset Pin');
  });

  it('clears the alarm without counting the wrong flip', () => {
    const state = makeState({ flipsRecorded: 2, alarmTripped: true });
    const next = resetPinBoost.apply(state, params);
    expect(next.alarmTripped).toBe(false);
    expect(next.resetPinUsed).toBe(true);
    expect(next.flipsRecorded).toBe(2);
  });

  it('is idempotent when already used', () => {
    const state = makeState({ alarmTripped: true, resetPinUsed: true });
    expect(resetPinBoost.apply(state, params)).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = makeState({ alarmTripped: true });
    const before = JSON.stringify(state);
    resetPinBoost.apply(state, params);
    expect(JSON.stringify(state)).toBe(before);
  });
});
