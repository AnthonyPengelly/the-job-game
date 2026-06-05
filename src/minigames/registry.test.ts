import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { MiniGame } from './contract';
import type { GameId } from '@/engine';
import { games, getGame, hasGame } from './registry';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FakeParams {
  value: number;
}
interface FakeState {
  done: boolean;
}

const fakeGame: MiniGame<FakeParams, FakeState> = {
  id: 'fake-game' as GameId,
  lanes: ['tech'],
  generate: () => ({ value: 1 }),
  Component: () => null,
  judge: (state) => (state.done ? 'clean' : 'botched'),
  boosts: [],
  minCommit: 1,
};

// ── Setup / teardown ──────────────────────────────────────────────────────────

let originalLength: number;

beforeEach(() => {
  originalLength = games.length;
});

afterEach(() => {
  // Restore the games array to its original state
  games.splice(originalLength);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('registry', () => {
  describe('getGame', () => {
    it('returns undefined for an unknown id', () => {
      expect(getGame('no-such-game')).toBeUndefined();
    });

    it('returns the game after it is registered', () => {
      games.push(fakeGame);
      const found = getGame('fake-game');
      expect(found).toBe(fakeGame);
    });

    it('returns undefined for a different id when only one game is registered', () => {
      games.push(fakeGame);
      expect(getGame('other-game')).toBeUndefined();
    });
  });

  describe('hasGame', () => {
    it('returns false for an unknown id', () => {
      expect(hasGame('no-such-game')).toBe(false);
    });

    it('returns true after the game is registered', () => {
      games.push(fakeGame);
      expect(hasGame('fake-game')).toBe(true);
    });

    it('returns false for a different id when only one game is registered', () => {
      games.push(fakeGame);
      expect(hasGame('other-game')).toBe(false);
    });
  });

  describe('games array', () => {
    it('starts empty (no games registered yet in E4.1)', () => {
      expect(games.length).toBe(0);
    });
  });
});
