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

// ── beat16-only EngineConfig ──────────────────────────────────────────────────

const beat16Cfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: { ...testCfg.scaling.minCommit, beat16: 1 },
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      beat16: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'beat16-vault',
        gameId: 'beat16',
        lane: 'physical',
        options: [
          { id: 'beat16-safe',   greedy: false, heatCost: 1, reward: 1 },
          { id: 'beat16-risky',  greedy: true,  heatCost: 2, reward: 2 },
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

interface MakeBeat16StoreOpts {
  physicalPowerUp?: boolean;
  twoPlayers?: boolean;
}

function makeBeat16Store(seed = 1, opts: MakeBeat16StoreOpts = {}) {
  const store = createGameStore({ cfg: beat16Cfg, storage: makeStorage() });
  const playerSetup = opts.twoPlayers
    ? [{ name: 'Alice' }, { name: 'Bob' }]
    : [{ name: 'Alice' }];
  store.getState().startRun(playerSetup, seed);

  const crew = store.getState().session.present.crew;
  const alice = crew[0]!;

  if (opts.physicalPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'physical', held: true });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with beat16Cfg');
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

describe('MinigameHost — Beat 16 ARMED state', () => {
  it('game component not mounted in ARMED — no timer can run on load', () => {
    const store = makeBeat16Store();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.queryByTestId('beat-16')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
  });

  it('DialReadout visible in ARMED state', () => {
    const store = makeBeat16Store();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
  });
});

// ── Game mounting ─────────────────────────────────────────────────────────────

describe('MinigameHost — beat16 game resolution', () => {
  it('mounts Beat16Component after START instead of the stub', () => {
    const store = makeBeat16Store();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('beat-16')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-outcome-clean')).not.toBeInTheDocument();
  });

  it('shows target beat and BPM info in ACTIVE', () => {
    const store = makeBeat16Store();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('target-beat')).toBeInTheDocument();
  });
});

// ── Seeded params reproducibility ─────────────────────────────────────────────

describe('MinigameHost — beat16 seeded params stable', () => {
  it('same seed → same target beat across two independent stores', () => {
    const storeA = makeBeat16Store(42);
    const { unmount: unmountA } = render(
      <StoreContext.Provider value={storeA}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const beatA = screen.getByTestId('target-beat').textContent;
    unmountA();

    const storeB = makeBeat16Store(42);
    render(
      <StoreContext.Provider value={storeB}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const beatB = screen.getByTestId('target-beat').textContent;

    expect(beatA).toBe(beatB);
  });
});

// ── Boost surfacing ───────────────────────────────────────────────────────────

describe('MinigameHost — beat16 boost (In the Bones)', () => {
  it('In the Bones boost surfaces in ACTIVE when physical power-up is held', () => {
    const store = makeBeat16Store(1, { physicalPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-physical')).toBeInTheDocument();
  });

  it('no boost renders when no physical power-up is held', () => {
    const store = makeBeat16Store(1, { physicalPowerUp: false });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('boost-physical')).not.toBeInTheDocument();
  });

  it('In the Bones fires once then disables', () => {
    const store = makeBeat16Store(1, { physicalPowerUp: true });
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

  it('In the Bones adds 2 audible beats', () => {
    const store = makeBeat16Store(1, { physicalPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const audibleBefore = screen.getByTestId('audible-beats').textContent ?? '';
    const countBefore = parseInt(audibleBefore.replace(/\D/g, ''), 10);

    fireEvent.click(screen.getByTestId('boost-physical'));

    const audibleAfter = screen.getByTestId('audible-beats').textContent ?? '';
    const countAfter = parseInt(audibleAfter.replace(/\D/g, ''), 10);

    expect(countAfter).toBe(countBefore + 2);
  });
});

// ── Outcome flow ──────────────────────────────────────────────────────────────

describe('MinigameHost — beat16 outcome flow', () => {
  it('GM confirms botched → RESOLVE_MINIGAME → phase is offer', () => {
    const store = makeBeat16Store();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('outcome-option-botched'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));
    // Shell RESOLVE confirm
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
    const store = makeBeat16Store();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('outcome-option-clean'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));
    // Shell RESOLVE confirm
    fireEvent.click(screen.getByTestId('outcome-confirm'));

    const history = store.getState().session.present.history;
    const last = history[history.length - 1];
    expect(last?.kind).toBe('obstacle');
    if (last?.kind === 'obstacle') {
      expect(last.outcome).toBe('clean');
    }
  });
});
