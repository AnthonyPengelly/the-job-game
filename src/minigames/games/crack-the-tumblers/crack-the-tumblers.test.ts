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

// ── Generator reproducibility ─────────────────────────────────────────────────

describe('generate — reproducibility', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    const p1 = generate(mulberry32(1312), d);
    const p2 = generate(mulberry32(1312), d);
    expect(p1).toEqual(p2);
  });

  it('different seeds produce different card layouts', () => {
    const p1 = generate(mulberry32(1), dial(0));
    const p2 = generate(mulberry32(9999), dial(0));
    expect(p1.correctOrder).not.toEqual(p2.correctOrder);
  });

  it('correctOrder is always ascending by card label value', () => {
    const params = generate(mulberry32(42), dial(0));
    const values = params.correctOrder.map(
      id => parseInt(params.cards.find(c => c.id === id)!.label, 10),
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('cards contains the same set as correctOrder', () => {
    const params = generate(mulberry32(7), dial(0));
    const cardIds = params.cards.map(c => c.id).sort();
    const orderIds = [...params.correctOrder].sort();
    expect(cardIds).toEqual(orderIds);
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ more cards', () => {
    const easy = generate(mulberry32(42), dial(-1));
    const hard = generate(mulberry32(42), dial(1));
    expect(hard.cards.length).toBeGreaterThanOrEqual(easy.cards.length);
  });

  it('higher dial ⇒ narrower minimum gaps', () => {
    const easy = generate(mulberry32(42), dial(-1));
    const hard = generate(mulberry32(42), dial(1));
    expect(hard.minGap).toBeLessThanOrEqual(easy.minGap);
  });

  it('clamps card count to minimum 3', () => {
    expect(generate(mulberry32(1), dial(-100)).cards.length).toBe(3);
  });

  it('clamps card count to maximum 7', () => {
    expect(generate(mulberry32(1), dial(100)).cards.length).toBe(7);
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<CrackTheTumblersState> = {}): CrackTheTumblersState {
  return {
    playedSequence: [],
    alarmTripped: false,
    resetPinUsed: false,
    ...overrides,
  };
}

describe('judge', () => {
  it('botched when alarmTripped', () => {
    const params = generate(mulberry32(1), dial(0));
    expect(judge(makeState({ alarmTripped: true }), params)).toBe('botched');
  });

  it('botched when sequence incomplete and no alarm', () => {
    const params = generate(mulberry32(1), dial(0));
    expect(judge(makeState({ playedSequence: [] }), params)).toBe('botched');
  });

  it('clean when all cards played in ascending order', () => {
    const params = generate(mulberry32(1), dial(0));
    expect(judge(makeState({ playedSequence: [...params.correctOrder] }), params)).toBe('clean');
  });

  it('complication when all cards played and Reset Pin was used', () => {
    const params = generate(mulberry32(1), dial(0));
    expect(
      judge(makeState({ playedSequence: [...params.correctOrder], resetPinUsed: true }), params),
    ).toBe('complication');
  });
});

// ── boost hooks ───────────────────────────────────────────────────────────────

describe('resetPinBoost', () => {
  it('has lane tech', () => {
    expect(resetPinBoost.lane).toBe('tech');
  });

  it('has label Reset Pin', () => {
    expect(resetPinBoost.label).toBe('Reset Pin');
  });

  it('removes the last played card and clears alarmTripped on first use', () => {
    const params = generate(mulberry32(1), dial(0));
    const ids = params.correctOrder;
    const state = makeState({
      playedSequence: [ids[0]!, ids[1]!],
      alarmTripped: true,
    });
    const next = resetPinBoost.apply(state, params);
    expect(next.resetPinUsed).toBe(true);
    expect(next.alarmTripped).toBe(false);
    expect(next.playedSequence).toEqual([ids[0]!]);
  });

  it('is idempotent when already used', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState({ resetPinUsed: true, playedSequence: [params.correctOrder[0]!] });
    const next = resetPinBoost.apply(state, params);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState({ playedSequence: [params.correctOrder[0]!] });
    const before = JSON.stringify(state);
    resetPinBoost.apply(state, params);
    expect(JSON.stringify(state)).toBe(before);
  });
});
