import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { judge, photographicBoost } from './judge';
import type { FollowTheCircuitState } from './judge';
import { followTheCircuit } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

// ── Registry ──────────────────────────────────────────────────────────────────

describe('followTheCircuit registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('followTheCircuit')).toBe(followTheCircuit);
  });

  it('has id followTheCircuit', () => {
    expect(followTheCircuit.id).toBe('followTheCircuit');
  });

  it('has lanes tech and physical', () => {
    expect(followTheCircuit.lanes).toEqual(['tech', 'physical']);
  });

  it('has minCommit 1', () => {
    expect(followTheCircuit.minCommit).toBe(1);
  });

  it('has no soloVariantId', () => {
    expect(followTheCircuit.soloVariantId).toBeUndefined();
  });

  it('has one boost hook (Photographic)', () => {
    expect(followTheCircuit.boosts).toHaveLength(1);
    expect(followTheCircuit.boosts[0]!.label).toBe('Photographic');
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
    expect(p1.targetLength).not.toEqual(p2.targetLength);
  });

  it('sequence length equals targetLength', () => {
    for (const level of [-2, 0, 2]) {
      const p = generate(mulberry32(7), dial(level));
      expect(p.sequence).toHaveLength(p.targetLength);
    }
  });

  it('sequence only contains card IDs from the grid', () => {
    const p = generate(mulberry32(99), dial(0));
    const validIds = new Set(p.cards.map(c => c.id));
    for (const id of p.sequence) {
      expect(validIds.has(id)).toBe(true);
    }
  });

  it('always produces a 4-card grid', () => {
    const p = generate(mulberry32(1), dial(0));
    expect(p.cards).toHaveLength(4);
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ longer target sequence', () => {
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.targetLength).toBeGreaterThanOrEqual(easy.targetLength);
  });

  it('higher dial ⇒ faster playback (lower playbackSpeedMs)', () => {
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.playbackSpeedMs).toBeLessThanOrEqual(easy.playbackSpeedMs);
  });

  it('targetLength is always within [3, 8]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.targetLength).toBeGreaterThanOrEqual(3);
      expect(p.targetLength).toBeLessThanOrEqual(8);
    }
  });

  it('playbackSpeedMs is always within [500, 1600]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.playbackSpeedMs).toBeGreaterThanOrEqual(500);
      expect(p.playbackSpeedMs).toBeLessThanOrEqual(1600);
    }
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<FollowTheCircuitState> = {}): FollowTheCircuitState {
  return {
    lengthReached: 0,
    chainBroke: false,
    photographicUsed: false,
    tapsThisRound: [],
    ...overrides,
  };
}

describe('judge — outcome boundaries', () => {
  const params = generate(mulberry32(1), dial(0));

  it('botched when game just started (no progress, no break)', () => {
    expect(judge(makeState(), params)).toBe('botched');
  });

  it('botched when chain broke early (more than one short)', () => {
    expect(
      judge(makeState({ chainBroke: true, lengthReached: 0 }), params),
    ).toBe('botched');
    expect(
      judge(makeState({ chainBroke: true, lengthReached: params.targetLength - 3 }), params),
    ).toBe('botched');
  });

  it('complication when chain broke exactly one short of target', () => {
    expect(
      judge(makeState({ chainBroke: true, lengthReached: params.targetLength - 1 }), params),
    ).toBe('complication');
  });

  it('clean when target length reached', () => {
    expect(
      judge(makeState({ lengthReached: params.targetLength }), params),
    ).toBe('clean');
    expect(
      judge(makeState({ lengthReached: params.targetLength + 1 }), params),
    ).toBe('clean');
  });
});

// ── boost hooks ───────────────────────────────────────────────────────────────

describe('photographicBoost', () => {
  it('has lane tech', () => {
    expect(photographicBoost.lane).toBe('tech');
  });

  it('has label Photographic', () => {
    expect(photographicBoost.label).toBe('Photographic');
  });

  it('sets photographicUsed to true on first use', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState();
    const next = photographicBoost.apply(state, params);
    expect(next.photographicUsed).toBe(true);
  });

  it('clears tapsThisRound when firing', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState({ tapsThisRound: [params.cards[0]!.id] });
    const next = photographicBoost.apply(state, params);
    expect(next.tapsThisRound).toHaveLength(0);
  });

  it('is idempotent when already used', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState({ photographicUsed: true });
    const next = photographicBoost.apply(state, params);
    expect(next).toBe(state);
  });

  it('does not mutate the input state', () => {
    const params = generate(mulberry32(1), dial(0));
    const state = makeState();
    const before = JSON.stringify(state);
    photographicBoost.apply(state, params);
    expect(JSON.stringify(state)).toBe(before);
  });
});
