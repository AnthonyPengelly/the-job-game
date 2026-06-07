// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
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

// ── the-once-over-only EngineConfig ───────────────────────────────────────────

const onceOverCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: { ...testCfg.scaling.minCommit, theOnceOver: 1 },
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      theOnceOver: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'onceover-gallery',
        gameId: 'theOnceOver',
        lane: 'stealth',
        options: [
          { id: 'onceover-patient', greedy: false, heatCost: 1, reward: 1 },
          { id: 'onceover-hasty',   greedy: true,  heatCost: 2, reward: 2 },
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

interface MakeOnceOverStoreOpts {
  stealthPowerUp?: boolean;
  twoPlayers?: boolean;
}

function makeOnceOverStore(seed = 1, opts: MakeOnceOverStoreOpts = {}) {
  const store = createGameStore({ cfg: onceOverCfg, storage: makeStorage() });
  const playerSetup = opts.twoPlayers
    ? [{ name: 'Alice' }, { name: 'Bob' }]
    : [{ name: 'Alice' }];
  store.getState().startRun(playerSetup, seed);

  const crew = store.getState().session.present.crew;
  const alice = crew[0]!;

  if (opts.stealthPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'stealth', held: true });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with onceOverCfg');
  }
  const committed: PlayerId[] = opts.twoPlayers ? crew.map(p => p.id) : [alice.id];
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed,
  });

  return store;
}

// ── ARMED state (timer guard) ─────────────────────────────────────────────────

describe('MinigameHost — TheOnceOver ARMED state', () => {
  it('game component not mounted in ARMED — no timer can run on load', () => {
    const store = makeOnceOverStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.queryByTestId('the-once-over')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
  });

  it('DialReadout visible in ARMED state', () => {
    const store = makeOnceOverStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
  });
});

// ── Game mounting ─────────────────────────────────────────────────────────────

describe('MinigameHost — the-once-over game mounting', () => {
  it('mounts TheOnceOverComponent after START instead of the stub', () => {
    const store = makeOnceOverStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('the-once-over')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-outcome-clean')).not.toBeInTheDocument();
  });

  it('starts in Study phase showing card spread', () => {
    const store = makeOnceOverStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('onceover-phase')).toHaveTextContent('Study');
    expect(screen.getByTestId('card-spread')).toBeInTheDocument();
  });

  it('shows change count', () => {
    const store = makeOnceOverStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('onceover-change-count')).toBeInTheDocument();
  });
});

// ── Seeded params reproducibility ─────────────────────────────────────────────

describe('MinigameHost — the-once-over seeded params stable', () => {
  it('same seed → same change count across two independent stores', () => {
    const storeA = makeOnceOverStore(42);
    const { unmount: unmountA } = render(
      <StoreContext.Provider value={storeA}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const countA = screen.getByTestId('onceover-change-count').textContent;
    unmountA();

    const storeB = makeOnceOverStore(42);
    render(
      <StoreContext.Provider value={storeB}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const countB = screen.getByTestId('onceover-change-count').textContent;

    expect(countA).toBe(countB);
  });
});

// ── Phase transition ──────────────────────────────────────────────────────────

/** Drain the Timer's 1s-tick loop by advancing one second at a time inside act(). */
async function drainStudyTimer(ticks: number): Promise<void> {
  for (let i = 0; i <= ticks; i++) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe('MinigameHost — the-once-over study → identify phase', () => {
  it('transitions to Identify phase when study timer expires (after START)', async () => {
    const store = makeOnceOverStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('onceover-phase')).toHaveTextContent('Study');
    // Max study time is 30s; advance 31 ticks to ensure expiry regardless of seed.
    await drainStudyTimer(31);
    expect(screen.getByTestId('onceover-phase')).toHaveTextContent('Identify');
  });

  it('shows flagged indicator section in Identify phase', async () => {
    const store = makeOnceOverStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    await drainStudyTimer(31);
    expect(screen.getByTestId('onceover-flagged')).toBeInTheDocument();
  });
});

// ── Boost surfacing ───────────────────────────────────────────────────────────

describe('MinigameHost — the-once-over boost (Hunch)', () => {
  it('Hunch boost surfaces in ACTIVE when stealth power-up is held', () => {
    const store = makeOnceOverStore(1, { stealthPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-stealth')).toBeInTheDocument();
  });

  it('no boost renders when no stealth power-up is held', () => {
    const store = makeOnceOverStore(1, { stealthPowerUp: false });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('boost-stealth')).not.toBeInTheDocument();
  });

  it('Hunch fires once then disables', () => {
    const store = makeOnceOverStore(1, { stealthPowerUp: true });
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

  it('Hunch shows the clue prompt after firing', () => {
    const store = makeOnceOverStore(1, { stealthPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('boost-stealth'));
    expect(screen.getByTestId('hunch-active')).toBeInTheDocument();
  });
});

// ── Outcome flow ──────────────────────────────────────────────────────────────

describe('MinigameHost — the-once-over outcome flow', () => {
  it('GM confirms botched → RESOLVE_MINIGAME → phase is offer', () => {
    const store = makeOnceOverStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    // Shell RESOLVE: botched pre-selected (no flags = botched)
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
    const store = makeOnceOverStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
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
