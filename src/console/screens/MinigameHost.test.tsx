// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { EngineConfig } from '@/engine';
import { games } from '@/minigames';
import type { MiniGame } from '@/minigames';
import type { GameId } from '@/engine';
import type { StorageLike } from '@/platform';
import { MinigameHost } from './MinigameHost';

afterEach(cleanup);

// ── Mock game ─────────────────────────────────────────────────────────────────

interface MockParams {
  value: number;
}
interface MockState {
  done: boolean;
}

const MOCK_GAME_ID = 'mockGame' as GameId;

const mockGame: MiniGame<MockParams, MockState> = {
  id: MOCK_GAME_ID,
  lanes: ['tech'],
  generate: (rng) => ({ value: rng.int(1, 10000) }),
  Component: ({ params, onResolve }) => (
    <div data-testid="mock-game-component">
      <span data-testid="mock-params-value">{params.value}</span>
      <button data-testid="mock-resolve-clean" onClick={() => onResolve('clean')}>
        Resolve Clean
      </button>
    </div>
  ),
  judge: () => 'clean',
  boosts: [],
  minCommit: 1,
};

// ── Config that always generates the mock-game obstacle ───────────────────────

const mockGameCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: { ...testCfg.scaling.minCommit, mockGame: 1 },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'obs-mock',
        gameId: 'mockGame',
        lane: 'tech',
        options: [
          { id: 'mock-safe', greedy: false, heatCost: 1, reward: 1 },
          { id: 'mock-greedy', greedy: true, heatCost: 2, reward: 2 },
        ],
      },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

/**
 * Build a store in the minigame phase for the mock-game obstacle.
 * Optionally boost the committed player's tech stat before committing.
 */
function makeMinigameStore(seed = 1, techStat = 0) {
  const store = createGameStore({ cfg: mockGameCfg, storage: makeStorage() });
  store.getState().startRun([{ name: 'Alice' }], seed);

  if (techStat !== 0) {
    const player = store.getState().session.present.crew[0]!;
    store.getState().dispatch({
      t: 'OVERRIDE_SET_STAT',
      player: player.id,
      lane: 'tech',
      value: techStat,
    });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with mockGameCfg');
  }
  const player = store.getState().session.present.crew[0]!;
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed: [player.id],
  });

  return store;
}

/** Parse the numeric dial level from DialReadout's "Difficulty: X.X" text. */
function readDialLevel(): number {
  const text = screen.getByTestId('dial-level').textContent ?? '';
  return parseFloat(text.replace('Difficulty: ', ''));
}

// ── Registry setup / teardown ─────────────────────────────────────────────────

let savedLength: number;

beforeEach(() => {
  savedLength = games.length;
});

afterEach(() => {
  games.splice(savedLength);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MinigameHost', () => {
  describe('graceful fallback', () => {
    it('renders MinigameStub outcome-picker when gameId is not registered', () => {
      // mockGame is NOT registered — getGame('mockGame') returns undefined
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      // Stub renders with its outcome buttons; host-only DialReadout is absent
      expect(screen.getByTestId('screen-minigame')).toBeInTheDocument();
      expect(screen.getByTestId('btn-outcome-clean')).toBeInTheDocument();
      expect(screen.queryByTestId('dial-readout')).not.toBeInTheDocument();
    });
  });

  describe('with a registered game', () => {
    beforeEach(() => {
      games.push(mockGame);
    });

    it('renders DialReadout and the game Component', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
      expect(screen.getByTestId('mock-game-component')).toBeInTheDocument();
    });

    it('dial level decreases (easier) as committed player stats rise', () => {
      // Low-stat player (tech=0)
      const storeLow = makeMinigameStore(1, 0);
      const { unmount: unmountLow } = render(
        <StoreContext.Provider value={storeLow}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const dialLow = readDialLevel();
      unmountLow();

      // High-stat player (tech=5)
      const storeHigh = makeMinigameStore(1, 5);
      render(
        <StoreContext.Provider value={storeHigh}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const dialHigh = readDialLevel();

      expect(isNaN(dialLow)).toBe(false);
      expect(isNaN(dialHigh)).toBe(false);
      expect(dialHigh).toBeLessThan(dialLow);
    });

    it('generates stable params across re-renders (seeded memo)', () => {
      const store = makeMinigameStore();
      const { rerender } = render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const value1 = screen.getByTestId('mock-params-value').textContent;

      // Re-render with the same store state — params memo must not regenerate
      rerender(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const value2 = screen.getByTestId('mock-params-value').textContent;

      expect(value1).not.toBeNull();
      expect(value1).toBe(value2);
    });

    it('two hosts with the same seed produce identical params (determinism)', () => {
      const storeA = makeMinigameStore(42);
      const { unmount: unmountA } = render(
        <StoreContext.Provider value={storeA}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const valueA = screen.getByTestId('mock-params-value').textContent;
      unmountA();

      const storeB = makeMinigameStore(42);
      render(
        <StoreContext.Provider value={storeB}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const valueB = screen.getByTestId('mock-params-value').textContent;

      expect(valueA).toBe(valueB);
    });

    it('forwards onResolve to RESOLVE_MINIGAME and advances to offer phase', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      fireEvent.click(screen.getByTestId('mock-resolve-clean'));

      expect(store.getState().session.present.phase).toBe('offer');
      const lastResult =
        store.getState().session.present.history[
          store.getState().session.present.history.length - 1
        ];
      expect(lastResult?.kind).toBe('obstacle');
      if (lastResult?.kind === 'obstacle') {
        expect(lastResult.outcome).toBe('clean');
      }
    });
  });
});
