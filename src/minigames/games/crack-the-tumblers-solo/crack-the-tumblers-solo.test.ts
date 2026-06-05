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

// ── Generator reproducibility ─────────────────────────────────────────────────

describe('generate — reproducibility', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    const p1 = generate(mulberry32(1312), d);
    const p2 = generate(mulberry32(1312), d);
    expect(p1).toEqual(p2);
  });

  it('different seeds produce different params', () => {
    const p1 = generate(mulberry32(1), dial(0));
    const p2 = generate(mulberry32(9999), dial(0));
    expect(p1.correctOrder).not.toEqual(p2.correctOrder);
  });

  it('correctOrder is ascending by studyCards label value', () => {
    const params = generate(mulberry32(42), dial(0));
    const values = params.correctOrder.map(
      id => parseInt(params.studyCards.find(c => c.id === id)!.label, 10),
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('recallCards contains the same cards as studyCards', () => {
    const params = generate(mulberry32(7), dial(0));
    const studyIds = params.studyCards.map(c => c.id).sort();
    const recallIds = params.recallCards.map(c => c.id).sort();
    expect(recallIds).toEqual(studyIds);
  });

  it('studySeconds decreases at higher dial (harder = less time)', () => {
    const easy = generate(mulberry32(1), dial(-1));
    const hard = generate(mulberry32(1), dial(1));
    expect(hard.studySeconds).toBeLessThanOrEqual(easy.studySeconds);
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ more cards', () => {
    const easy = generate(mulberry32(42), dial(-1));
    const hard = generate(mulberry32(42), dial(1));
    expect(hard.studyCards.length).toBeGreaterThanOrEqual(easy.studyCards.length);
  });

  it('clamps card count to minimum 3', () => {
    expect(generate(mulberry32(1), dial(-100)).studyCards.length).toBe(3);
  });

  it('clamps card count to maximum 6', () => {
    expect(generate(mulberry32(1), dial(100)).studyCards.length).toBe(6);
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<CrackTheTumblersSoloState> = {}): CrackTheTumblersSoloState {
  return {
    phase: 'recall',
    recallSequence: [],
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

  it('botched when sequence incomplete', () => {
    const params = generate(mulberry32(1), dial(0));
    expect(judge(makeState({ recallSequence: [] }), params)).toBe('botched');
  });

  it('clean when full sequence correctly recalled', () => {
    const params = generate(mulberry32(1), dial(0));
    expect(judge(makeState({ recallSequence: [...params.correctOrder] }), params)).toBe('clean');
  });

  it('complication when full sequence recalled and Reset Pin was used', () => {
    const params = generate(mulberry32(1), dial(0));
    expect(
      judge(makeState({ recallSequence: [...params.correctOrder], resetPinUsed: true }), params),
    ).toBe('complication');
  });
});

// ── boost hooks ───────────────────────────────────────────────────────────────

describe('resetPinBoost (solo)', () => {
  it('has lane tech', () => {
    expect(resetPinBoost.lane).toBe('tech');
  });

  it('has label Reset Pin', () => {
    expect(resetPinBoost.label).toBe('Reset Pin');
  });

  it('removes the last recalled card and clears alarmTripped on first use', () => {
    const params = generate(mulberry32(1), dial(0));
    const ids = params.correctOrder;
    const state = makeState({
      recallSequence: [ids[0]!, ids[1]!],
      alarmTripped: true,
    });
    const next = resetPinBoost.apply(state, params);
    expect(next.resetPinUsed).toBe(true);
    expect(next.alarmTripped).toBe(false);
    expect(next.recallSequence).toEqual([ids[0]!]);
  });

  it('is idempotent when already used', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState({ resetPinUsed: true });
    const next = resetPinBoost.apply(state, params);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState({ recallSequence: [params.correctOrder[0]!] });
    const before = JSON.stringify(state);
    resetPinBoost.apply(state, params);
    expect(JSON.stringify(state)).toBe(before);
  });
});
