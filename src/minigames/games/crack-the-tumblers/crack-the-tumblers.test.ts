import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, resetPinBoost } from './judge';
import type { CrackTheTumblersState } from './judge';
import { crackTheTumblers } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('crackTheTumblers registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('crackTheTumblers')).toBe(crackTheTumblers);
  });

  it('has id crackTheTumblers', () => {
    expect(crackTheTumblers.id).toBe('crackTheTumblers');
  });

  it('has lane tech', () => {
    expect(crackTheTumblers.lanes).toEqual(['tech']);
  });

  it('has minCommit 2', () => {
    expect(crackTheTumblers.minCommit).toBe(2);
  });

  it('has soloVariantId crackTheTumblersSolo', () => {
    expect(crackTheTumblers.soloVariantId).toBe('crackTheTumblersSolo');
  });

  it('has one boost hook', () => {
    expect(crackTheTumblers.boosts).toHaveLength(1);
  });
});

// ── Generator ────────────────────────────────────────────────────────────────

describe('generate — physical deal parameters', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    expect(generate(mulberry32(1312), d)).toEqual(generate(mulberry32(1312), d));
  });

  it('same dial gives same params regardless of seed (deal randomness is physical)', () => {
    const d = dial(1);
    expect(generate(mulberry32(1), d)).toEqual(generate(mulberry32(9999), d));
  });

  it('higher dial ⇒ more cards per player (harder)', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(2));
    expect(hard.cardsPerPlayer).toBeGreaterThanOrEqual(easy.cardsPerPlayer);
  });

  it('cardsPerPlayer stays within a dealable range [1, 3]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.cardsPerPlayer).toBeGreaterThanOrEqual(1);
      expect(p.cardsPerPlayer).toBeLessThanOrEqual(3);
    }
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<CrackTheTumblersState> = {}): CrackTheTumblersState {
  return {
    totalCards: 4,
    playsRecorded: 0,
    alarmTripped: false,
    resetPinUsed: false,
    ...overrides,
  };
}

const params = generate(mulberry32(1), dial(0));

describe('judge', () => {
  it('botched when alarmTripped', () => {
    expect(judge(makeState({ alarmTripped: true, playsRecorded: 4 }))).toBe('botched');
  });

  it('botched when sequence incomplete and no alarm', () => {
    expect(judge(makeState({ playsRecorded: 3 }))).toBe('botched');
  });

  it('clean when all cards recorded in order', () => {
    expect(judge(makeState({ playsRecorded: 4 }))).toBe('clean');
  });

  it('complication when completed but Reset Pin was used', () => {
    expect(judge(makeState({ playsRecorded: 4, resetPinUsed: true }))).toBe('complication');
  });
});

// ── resetPinBoost ─────────────────────────────────────────────────────────────

describe('resetPinBoost', () => {
  it('has lane tech', () => {
    expect(resetPinBoost.lane).toBe('tech');
  });

  it('has label Reset Pin', () => {
    expect(resetPinBoost.label).toBe('Reset Pin');
  });

  it('clears the alarm without counting the misplay', () => {
    const state = makeState({ playsRecorded: 2, alarmTripped: true });
    const next = resetPinBoost.apply(state, params);
    expect(next.alarmTripped).toBe(false);
    expect(next.resetPinUsed).toBe(true);
    expect(next.playsRecorded).toBe(2);
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
