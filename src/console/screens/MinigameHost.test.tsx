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
import type { ParsedNarration } from '@/content/schema';
import { MinigameHost } from './MinigameHost';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';

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
      <StatusZone>
        <span data-testid="mock-params-value">{params.value}</span>
      </StatusZone>
      <ChallengeZone>
        <span>Challenge area</span>
      </ChallengeZone>
      <RefereeZone>
        <button data-testid="mock-resolve-clean" onClick={() => onResolve('clean')}>
          Resolve Clean
        </button>
        <button data-testid="mock-resolve-botched" onClick={() => onResolve('botched')}>
          Resolve Botched
        </button>
      </RefereeZone>
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

// ── Narration fixture ─────────────────────────────────────────────────────────

function makeNarrationFixture(): ParsedNarration {
  const variants = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, text: `${prefix} text ${i}` }));
  return {
    briefing: variants('br', 6),
    obstacleClue: variants('oc', 10),
    optionDescription: variants('od', 10),
    pushRun: variants('pr', 8),
    outcomeQuip: [
      { id: 'oq-clean-0', text: 'Clean quip A', when: { outcome: 'clean' } },
      { id: 'oq-clean-1', text: 'Clean quip B', when: { outcome: 'clean' } },
      { id: 'oq-complication-0', text: 'Complication quip A', when: { outcome: 'complication' } },
      { id: 'oq-complication-1', text: 'Complication quip B', when: { outcome: 'complication' } },
      { id: 'oq-botched-0', text: 'Botched quip A', when: { outcome: 'botched' } },
      { id: 'oq-botched-1', text: 'Botched quip B', when: { outcome: 'botched' } },
    ],
    scenarioSetup: variants('ss', 8),
    getawayIntro: variants('gi', 6),
    getawayCountdown: variants('gc', 6),
    winSting: variants('ws', 6),
    bustSting: variants('bs', 6),
  };
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

  describe('ARMED state (game not yet started)', () => {
    beforeEach(() => {
      games.push(mockGame);
    });

    it('shows DialReadout and START button in ARMED state', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
      expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
    });

    it('game component is NOT mounted in ARMED state (no timer can run)', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      expect(screen.queryByTestId('mock-game-component')).not.toBeInTheDocument();
      // Confirm ARMED state is shown
      expect(screen.getByTestId('mg-armed')).toBeInTheDocument();
    });

    it('shows game name in ARMED state', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      expect(screen.getByTestId('mg-game-name')).toBeInTheDocument();
    });
  });

  describe('ACTIVE state (after START)', () => {
    beforeEach(() => {
      games.push(mockGame);
    });

    it('mounts game Component after clicking START', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      fireEvent.click(screen.getByTestId('btn-minigame-start'));

      expect(screen.getByTestId('mock-game-component')).toBeInTheDocument();
      expect(screen.getByTestId('mg-active')).toBeInTheDocument();
    });

    it('standard zones present in ACTIVE state', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      fireEvent.click(screen.getByTestId('btn-minigame-start'));

      expect(screen.getByTestId('mg-status-zone')).toBeInTheDocument();
      expect(screen.getByTestId('mg-challenge-zone')).toBeInTheDocument();
      expect(screen.getByTestId('mg-referee-zone')).toBeInTheDocument();
    });

    it('dial level decreases (easier) as committed player stats rise', () => {
      // Dial is shown in ARMED state
      const storeLow = makeMinigameStore(1, 0);
      const { unmount: unmountLow } = render(
        <StoreContext.Provider value={storeLow}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const dialLow = readDialLevel();
      unmountLow();

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
      fireEvent.click(screen.getByTestId('btn-minigame-start'));
      const value1 = screen.getByTestId('mock-params-value').textContent;

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
      fireEvent.click(screen.getByTestId('btn-minigame-start'));
      const valueA = screen.getByTestId('mock-params-value').textContent;
      unmountA();

      const storeB = makeMinigameStore(42);
      render(
        <StoreContext.Provider value={storeB}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      fireEvent.click(screen.getByTestId('btn-minigame-start'));
      const valueB = screen.getByTestId('mock-params-value').textContent;

      expect(valueA).toBe(valueB);
    });
  });

  describe('RESOLVE state', () => {
    beforeEach(() => {
      games.push(mockGame);
    });

    it('RESOLVE pre-selects the suggested outcome (clean)', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      fireEvent.click(screen.getByTestId('btn-minigame-start'));
      fireEvent.click(screen.getByTestId('mock-resolve-clean'));

      // Shell in RESOLVE: OutcomeJudge shown, clean pre-selected
      expect(screen.getByTestId('mg-resolve')).toBeInTheDocument();
      expect(screen.getByTestId('outcome-option-clean')).toHaveAttribute('data-selected', 'true');
      // Game component unmounted
      expect(screen.queryByTestId('mock-game-component')).not.toBeInTheDocument();
    });

    it('RESOLVE pre-selects the suggested outcome (botched)', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      fireEvent.click(screen.getByTestId('btn-minigame-start'));
      fireEvent.click(screen.getByTestId('mock-resolve-botched'));

      expect(screen.getByTestId('outcome-option-botched')).toHaveAttribute('data-selected', 'true');
    });

    it('only the shell confirm dispatches RESOLVE_MINIGAME (no narration)', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      fireEvent.click(screen.getByTestId('btn-minigame-start'));
      fireEvent.click(screen.getByTestId('mock-resolve-clean'));
      // RESOLVE state: game not dispatched yet
      expect(store.getState().session.present.phase).toBe('minigame');
      // GM confirms in shell
      fireEvent.click(screen.getByTestId('outcome-confirm'));

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

    it('Back from RESOLVE returns to ACTIVE game (no dead-end)', () => {
      const store = makeMinigameStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      fireEvent.click(screen.getByTestId('btn-minigame-start'));
      fireEvent.click(screen.getByTestId('mock-resolve-clean'));
      expect(screen.getByTestId('mg-resolve')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('btn-back-to-game'));

      expect(screen.getByTestId('mock-game-component')).toBeInTheDocument();
      expect(screen.queryByTestId('mg-resolve')).not.toBeInTheDocument();
    });
  });
});

// ── Narration: outcomeQuip ────────────────────────────────────────────────────

describe('MinigameHost — outcome quip narration', () => {
  let savedLen: number;

  beforeEach(() => {
    savedLen = games.length;
    games.push(mockGame);
  });

  afterEach(() => {
    games.splice(savedLen);
    cleanup();
  });

  function makeMinigameStoreWithNarration(seed = 1) {
    const narration = makeNarrationFixture();
    const store = createGameStore({ cfg: mockGameCfg, storage: makeStorage(), narration });
    store.getState().startRun([{ name: 'Alice' }], seed);

    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') {
      throw new Error('Expected obstacle room');
    }
    const player = store.getState().session.present.crew[0]!;
    store.getState().dispatch({
      t: 'CHOOSE_OPTION',
      optionId: room.options[0]!.id,
      committed: [player.id],
    });
    return store;
  }

  it('shows outcome-quip teleprompter after GM confirms in RESOLVE', () => {
    const store = makeMinigameStoreWithNarration();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('mock-resolve-clean'));
    // GM confirms in RESOLVE
    fireEvent.click(screen.getByTestId('outcome-confirm'));

    expect(screen.getByTestId('outcome-quip')).toBeInTheDocument();
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Clean quip');
  });

  it('quip is scoped to the chosen outcome — botched shows botched quip', () => {
    const store = makeMinigameStoreWithNarration();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('mock-resolve-botched'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));

    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Botched quip');
  });

  it('confirm button dispatches RESOLVE_MINIGAME → offer phase', () => {
    const store = makeMinigameStoreWithNarration();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('mock-resolve-clean'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));  // RESOLVE confirm → quip
    fireEvent.click(screen.getByTestId('btn-confirm-outcome'));  // quip confirm → dispatch

    expect(store.getState().session.present.phase).toBe('offer');
  });

  it('back button from quip returns to ARMED (no dead-end)', () => {
    const store = makeMinigameStoreWithNarration();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('mock-resolve-clean'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));  // → quip
    expect(screen.getByTestId('outcome-quip')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-back-outcome'));

    // Back from quip: shell remounts in ARMED, can START again
    expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
    expect(screen.queryByTestId('outcome-quip')).toBeNull();
  });

  it('advance button re-picks a quip (same outcome, never blocks)', () => {
    const store = makeMinigameStoreWithNarration();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('mock-resolve-clean'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));  // → quip

    const advanceBtn = screen.getByTestId('teleprompter-advance');
    expect(advanceBtn).not.toBeDisabled();
    fireEvent.click(advanceBtn);
    // After advance the line element is still present
    expect(screen.getByTestId('teleprompter-line')).toBeInTheDocument();
    // The text is still a clean quip
    const lineAfter = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(lineAfter).toContain('Clean quip');
  });
});
