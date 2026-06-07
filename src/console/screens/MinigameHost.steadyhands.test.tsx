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

// ── steadyHands-only EngineConfig ─────────────────────────────────────────────

const steadyHandsCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: { ...testCfg.scaling.minCommit, steadyHands: 1 },
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      steadyHands: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'sh-vault',
        gameId: 'steadyHands',
        lane: 'physical',
        options: [
          { id: 'sh-safe',   greedy: false, heatCost: 1, reward: 1 },
          { id: 'sh-risky',  greedy: true,  heatCost: 2, reward: 2 },
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

interface MakeSteadyHandsStoreOpts {
  physicalPowerUp?: boolean;
  stealthPowerUp?: boolean;
  twoPlayers?: boolean;
}

function makeSteadyHandsStore(seed = 1, opts: MakeSteadyHandsStoreOpts = {}) {
  const store = createGameStore({ cfg: steadyHandsCfg, storage: makeStorage() });
  const playerSetup = opts.twoPlayers
    ? [{ name: 'Alice' }, { name: 'Bob' }]
    : [{ name: 'Alice' }];
  store.getState().startRun(playerSetup, seed);

  const crew = store.getState().session.present.crew;
  const alice = crew[0]!;

  if (opts.physicalPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'physical', held: true });
  }
  if (opts.stealthPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'stealth', held: true });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with steadyHandsCfg');
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

// ── ARMED state (timer guard) ─────────────────────────────────────────────────

describe('MinigameHost — SteadyHands ARMED state', () => {
  it('game component not mounted in ARMED — no timer can run on load', () => {
    const store = makeSteadyHandsStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.queryByTestId('steady-hands')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
  });

  it('DialReadout visible in ARMED state', () => {
    const store = makeSteadyHandsStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
  });
});

// ── Game mounting ─────────────────────────────────────────────────────────────

describe('MinigameHost — steadyHands game mounting', () => {
  it('mounts SteadyHandsComponent after START instead of the stub', () => {
    const store = makeSteadyHandsStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('steady-hands')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-outcome-clean')).not.toBeInTheDocument();
  });

  it('shows target height in ACTIVE', () => {
    const store = makeSteadyHandsStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('sh-target-height')).toBeInTheDocument();
  });

  it('shows a timer in ACTIVE', () => {
    const store = makeSteadyHandsStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });

  it('renders standard status/challenge/referee zones in ACTIVE', () => {
    const store = makeSteadyHandsStore();
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

  it('Call Outcome button is present in ACTIVE', () => {
    const store = makeSteadyHandsStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('btn-call-outcome')).toBeInTheDocument();
  });
});

// ── Seeded params reproducibility ─────────────────────────────────────────────

describe('MinigameHost — steadyHands seeded params stable', () => {
  it('same seed → same target height across two independent stores', () => {
    const storeA = makeSteadyHandsStore(42);
    const { unmount: unmountA } = render(
      <StoreContext.Provider value={storeA}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const heightA = screen.getByTestId('sh-target-height').textContent;
    unmountA();

    const storeB = makeSteadyHandsStore(42);
    render(
      <StoreContext.Provider value={storeB}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const heightB = screen.getByTestId('sh-target-height').textContent;

    expect(heightA).toBe(heightB);
  });
});

// ── Boost surfacing ───────────────────────────────────────────────────────────

describe('MinigameHost — steadyHands boost surfacing', () => {
  it('Extra Hands boost surfaces in ACTIVE when physical power-up is held', () => {
    const store = makeSteadyHandsStore(1, { physicalPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-physical')).toBeInTheDocument();
  });

  it('Steady Breath boost surfaces in ACTIVE when stealth power-up is held', () => {
    const store = makeSteadyHandsStore(1, { stealthPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-stealth')).toBeInTheDocument();
  });

  it('no boost renders when no power-up is held', () => {
    const store = makeSteadyHandsStore(1);
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('boost-physical')).not.toBeInTheDocument();
    expect(screen.queryByTestId('boost-stealth')).not.toBeInTheDocument();
  });

  it('Extra Hands boost fires once then disables', () => {
    const store = makeSteadyHandsStore(1, { physicalPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const btn = screen.getByTestId('boost-physical');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it('Steady Breath boost fires once then disables', () => {
    const store = makeSteadyHandsStore(1, { stealthPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const btn = screen.getByTestId('boost-stealth');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it('Extra Hands shows all-hands banner after firing', () => {
    const store = makeSteadyHandsStore(1, { physicalPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('sh-extra-hands')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('boost-physical'));
    expect(screen.getByTestId('sh-extra-hands')).toBeInTheDocument();
  });

  it('Steady Breath shows wobble-forgiven indicator after firing', () => {
    const store = makeSteadyHandsStore(1, { stealthPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('sh-wobble-forgiven')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('boost-stealth'));
    expect(screen.getByTestId('sh-wobble-forgiven')).toBeInTheDocument();
  });

  it('both boosts surface independently when both power-ups are held', () => {
    const store = createGameStore({ cfg: steadyHandsCfg, storage: makeStorage() });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    const crew = store.getState().session.present.crew;
    const alice = crew[0]!;
    const bob = crew[1]!;
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'physical', held: true });
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: bob.id, lane: 'stealth', held: true });
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
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-physical')).toBeInTheDocument();
    expect(screen.getByTestId('boost-stealth')).toBeInTheDocument();
  });
});

// ── Outcome flow ──────────────────────────────────────────────────────────────

describe('MinigameHost — steadyHands outcome flow', () => {
  it('GM confirms clean → RESOLVE_MINIGAME → phase is offer', () => {
    const store = makeSteadyHandsStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    // Override to clean in Shell RESOLVE
    fireEvent.click(screen.getByTestId('outcome-option-clean'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));

    expect(store.getState().session.present.phase).toBe('offer');
    const history = store.getState().session.present.history;
    const last = history[history.length - 1];
    expect(last?.kind).toBe('obstacle');
    if (last?.kind === 'obstacle') {
      expect(last.outcome).toBe('clean');
    }
  });

  it('GM confirms botched → recorded as botched', () => {
    const store = makeSteadyHandsStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    // Override to botched in Shell RESOLVE
    fireEvent.click(screen.getByTestId('outcome-option-botched'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));

    const history = store.getState().session.present.history;
    const last = history[history.length - 1];
    expect(last?.kind).toBe('obstacle');
    if (last?.kind === 'obstacle') {
      expect(last.outcome).toBe('botched');
    }
  });
});
