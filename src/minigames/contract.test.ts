import { describe, it, expect } from 'vitest';
import type { MiniGame, BoostHook, Difficulty, CommittedPlayer } from './contract';
import type { GameId, PlayerId } from '@/engine';
import { mulberry32 } from '@/engine';

// ── Minimal concrete types for exercising the contract ────────────────────────

interface TestParams {
  code: readonly number[];
  guessLimit: number;
}

interface TestState {
  guessesUsed: number;
  solved: boolean;
  techBoostUsed: boolean;
}

// ── A minimal MiniGame implementation that satisfies the contract ─────────────

const stethoscopeBoost: BoostHook<TestState, TestParams> = {
  lane: 'tech',
  label: 'Stethoscope',
  apply(state) {
    return { ...state, techBoostUsed: true };
  },
};

const mockGame: MiniGame<TestParams, TestState> = {
  id: 'test-safe-crack' as GameId,
  lanes: ['tech', 'stealth'],
  generate(rng, dial) {
    const digitCount = Math.max(1, 4 - Math.floor(dial.level));
    const code = Array.from({ length: digitCount }, () => rng.int(1, 9));
    const guessLimit = 3 + Math.floor(dial.level * 2);
    return { code, guessLimit };
  },
  Component: () => null,
  judge(state, params) {
    if (!state.solved) return 'botched';
    if (state.guessesUsed < params.guessLimit) return 'clean';
    return 'complication';
  },
  boosts: [stethoscopeBoost],
  minCommit: 1,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MiniGame contract', () => {
  describe('generate', () => {
    it('produces identical params from the same seed and dial', () => {
      const dial: Difficulty = { level: 2 };
      const params1 = mockGame.generate(mulberry32(42), dial);
      const params2 = mockGame.generate(mulberry32(42), dial);
      expect(params1).toEqual(params2);
    });

    it('produces different params from different seeds', () => {
      const dial: Difficulty = { level: 2 };
      const params1 = mockGame.generate(mulberry32(1), dial);
      const params2 = mockGame.generate(mulberry32(99999), dial);
      // Different seeds almost certainly yield different codes
      expect(params1.code).not.toEqual(params2.code);
    });

    it('higher dial level yields more guesses (wider tolerance)', () => {
      const rng = mulberry32(7);
      const easy = mockGame.generate(rng, { level: 0 });
      const hard = mockGame.generate(mulberry32(7), { level: 3 });
      expect(hard.guessLimit).toBeGreaterThanOrEqual(easy.guessLimit);
    });
  });

  describe('judge', () => {
    const params: TestParams = { code: [1, 2, 3], guessLimit: 5 };

    it('returns clean when solved with guesses remaining', () => {
      const state: TestState = { solved: true, guessesUsed: 2, techBoostUsed: false };
      expect(mockGame.judge(state, params)).toBe('clean');
    });

    it('returns complication when solved on the last guess', () => {
      const state: TestState = { solved: true, guessesUsed: 5, techBoostUsed: false };
      expect(mockGame.judge(state, params)).toBe('complication');
    });

    it('returns botched when not solved', () => {
      const state: TestState = { solved: false, guessesUsed: 5, techBoostUsed: false };
      expect(mockGame.judge(state, params)).toBe('botched');
    });
  });

  describe('BoostHook', () => {
    it('apply is pure — returns new state without mutating the original', () => {
      const params: TestParams = { code: [1, 2, 3], guessLimit: 5 };
      const before: TestState = { solved: false, guessesUsed: 1, techBoostUsed: false };
      const after = stethoscopeBoost.apply(before, params);
      expect(after.techBoostUsed).toBe(true);
      expect(before.techBoostUsed).toBe(false);
    });
  });

  describe('CommittedPlayer shape', () => {
    it('conforms to the expected structure', () => {
      const player: CommittedPlayer = {
        id: 'p1' as PlayerId,
        name: 'Anna',
        stats: { tech: 2, physical: 1, charm: 1, stealth: 3 },
        powerUps: { tech: true },
      };
      expect(player.stats.tech).toBe(2);
      expect(player.powerUps.tech).toBe(true);
      expect(player.powerUps.stealth).toBeUndefined();
    });
  });
});
