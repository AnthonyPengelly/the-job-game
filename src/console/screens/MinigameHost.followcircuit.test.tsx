// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { EngineConfig, PlayerId } from '@/engine';
import type { StorageLike } from '@/platform';
import { MinigameHost } from './MinigameHost';

afterEach(cleanup);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── followTheCircuit-only EngineConfig ────────────────────────────────────────

const ftcCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: { ...testCfg.scaling.minCommit, followTheCircuit: 1 },
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      followTheCircuit: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'ftc-server-room',
        gameId: 'followTheCircuit',
        lane: 'tech',
        options: [
          { id: 'ftc-methodical', greedy: false, heatCost: 1, reward: 1 },
          { id: 'ftc-shortcut',   greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
    ],
  },
};

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem:    (k: string) => data.get(k) ?? null,
    setItem:    (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

interface MakeFtcStoreOpts {
  techPowerUp?: boolean;
  physicalPowerUp?: boolean;
  twoPlayers?: boolean;
}

function makeFtcStore(seed = 1, opts: MakeFtcStoreOpts = {}) {
  const store = createGameStore({ cfg: ftcCfg, storage: makeStorage() });
  const playerSetup = opts.twoPlayers
    ? [{ name: 'Alice' }, { name: 'Bob' }]
    : [{ name: 'Alice' }];
  store.getState().startRun(playerSetup, seed);

  const crew = store.getState().session.present.crew;
  const alice = crew[0]!;

  if (opts.techPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'tech', held: true });
  }
  if (opts.physicalPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'physical', held: true });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with ftcCfg');
  }
  const committed: PlayerId[] = opts.twoPlayers
    ? crew.map(p => p.id)
    : [alice.id];
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed,
  });

  return store;
}

// ── Game mounting ─────────────────────────────────────────────────────────────

describe('MinigameHost — followTheCircuit game mounting', () => {
  it('mounts FollowTheCircuitComponent instead of the stub', () => {
    const store = makeFtcStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('follow-the-circuit')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-outcome-clean')).not.toBeInTheDocument();
  });

  it('renders DialReadout alongside the game component', () => {
    const store = makeFtcStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
  });

  it('shows progress info', () => {
    const store = makeFtcStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('ftc-progress')).toBeInTheDocument();
  });

  it('shows the 4-card grid', () => {
    const store = makeFtcStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('card-spread')).toBeInTheDocument();
  });
});

// ── Seeded params reproducibility ─────────────────────────────────────────────

describe('MinigameHost — followTheCircuit seeded params stable', () => {
  it('same seed → same progress display across two independent stores', () => {
    const storeA = makeFtcStore(42);
    const { unmount: unmountA } = render(
      <StoreContext.Provider value={storeA}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    const progressA = screen.getByTestId('ftc-progress').textContent;
    unmountA();

    const storeB = makeFtcStore(42);
    render(
      <StoreContext.Provider value={storeB}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    const progressB = screen.getByTestId('ftc-progress').textContent;

    expect(progressA).toBe(progressB);
  });
});

// ── Boost surfacing ───────────────────────────────────────────────────────────

describe('MinigameHost — followTheCircuit boost surfacing', () => {
  it('Photographic boost surfaces when tech power-up is held', () => {
    const store = makeFtcStore(1, { techPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('boost-tech')).toBeInTheDocument();
  });

  it('Muscle Memory boost surfaces when physical power-up is held', () => {
    const store = makeFtcStore(1, { physicalPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('boost-physical')).toBeInTheDocument();
  });

  it('no boost renders when neither power-up is held', () => {
    const store = makeFtcStore(1);
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.queryByTestId('boost-tech')).not.toBeInTheDocument();
    expect(screen.queryByTestId('boost-physical')).not.toBeInTheDocument();
  });

  it('Photographic boost fires once then disables', () => {
    const store = makeFtcStore(1, { techPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    const btn = screen.getByTestId('boost-tech');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it('Muscle Memory boost fires once then disables', () => {
    const store = makeFtcStore(1, { physicalPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    const btn = screen.getByTestId('boost-physical');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it('both boosts surface independently when both power-ups are held', () => {
    const store = createGameStore({ cfg: ftcCfg, storage: makeStorage() });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    const crew = store.getState().session.present.crew;
    const alice = crew[0]!;
    const bob = crew[1]!;
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'tech', held: true });
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: bob.id, lane: 'physical', held: true });
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle');
    store.getState().dispatch({
      t: 'CHOOSE_OPTION',
      optionId: room.options[0]!.id,
      committed: crew.map(p => p.id),
    });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('boost-tech')).toBeInTheDocument();
    expect(screen.getByTestId('boost-physical')).toBeInTheDocument();
  });
});

// ── Outcome flow ──────────────────────────────────────────────────────────────

describe('MinigameHost — followTheCircuit outcome flow', () => {
  it('GM confirms botched → RESOLVE_MINIGAME → phase is offer', () => {
    const store = makeFtcStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('outcome-option-botched'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));

    expect(store.getState().session.present.phase).toBe('offer');
    const history = store.getState().session.present.history;
    const last = history[history.length - 1];
    expect(last?.kind).toBe('obstacle');
    if (last?.kind === 'obstacle') {
      expect(last.outcome).toBe('botched');
    }
  });

  it('GM overrides to clean → recorded as clean', () => {
    const store = makeFtcStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('outcome-option-clean'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));

    const history = store.getState().session.present.history;
    const last = history[history.length - 1];
    expect(last?.kind).toBe('obstacle');
    if (last?.kind === 'obstacle') {
      expect(last.outcome).toBe('clean');
    }
  });
});
