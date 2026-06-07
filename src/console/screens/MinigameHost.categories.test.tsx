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

// ── categories-only EngineConfig ──────────────────────────────────────────────

const categoriesCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: { ...testCfg.scaling.minCommit, categories: 1 },
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      categories: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'categories-lobby',
        gameId: 'categories',
        lane: 'charm',
        options: [
          { id: 'categories-quiet', greedy: false, heatCost: 1, reward: 1 },
          { id: 'categories-risky', greedy: true,  heatCost: 2, reward: 2 },
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

interface MakeCategoriesStoreOpts {
  charmPowerUp?: boolean;
  twoPlayers?: boolean;
}

function makeCategoriesStore(seed = 1, opts: MakeCategoriesStoreOpts = {}) {
  const store = createGameStore({ cfg: categoriesCfg, storage: makeStorage() });
  const playerSetup = opts.twoPlayers
    ? [{ name: 'Alice' }, { name: 'Bob' }]
    : [{ name: 'Alice' }];
  store.getState().startRun(playerSetup, seed);

  const crew = store.getState().session.present.crew;
  const alice = crew[0]!;

  if (opts.charmPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'charm', held: true });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with categoriesCfg');
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

describe('MinigameHost — Categories ARMED state', () => {
  it('game component not mounted in ARMED — timer cannot run on load', () => {
    const store = makeCategoriesStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    // Game component (with timer) not mounted
    expect(screen.queryByTestId('categories')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    // START CTA visible
    expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
  });

  it('DialReadout visible in ARMED state', () => {
    const store = makeCategoriesStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
  });
});

// ── Game mounting ─────────────────────────────────────────────────────────────

describe('MinigameHost — categories game mounting', () => {
  it('mounts CategoriesComponent after START instead of the stub', () => {
    const store = makeCategoriesStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('categories')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-outcome-clean')).not.toBeInTheDocument();
  });

  it('shows the category prompt and target count in ACTIVE', () => {
    const store = makeCategoriesStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('categories-category')).toBeInTheDocument();
    expect(screen.getByTestId('categories-target')).toBeInTheDocument();
  });

  it('shows a timer in ACTIVE', () => {
    const store = makeCategoriesStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });

  it('shows a tally counter starting at 0 in ACTIVE', () => {
    const store = makeCategoriesStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('tally-count').textContent).toContain('0');
  });
});

// ── Seeded params reproducibility ─────────────────────────────────────────────

describe('MinigameHost — categories seeded params stable', () => {
  it('same seed → same category across two independent stores', () => {
    const storeA = makeCategoriesStore(42);
    const { unmount: unmountA } = render(
      <StoreContext.Provider value={storeA}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const categoryA = screen.getByTestId('categories-category').textContent;
    unmountA();

    const storeB = makeCategoriesStore(42);
    render(
      <StoreContext.Provider value={storeB}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const categoryB = screen.getByTestId('categories-category').textContent;

    expect(categoryA).toBe(categoryB);
  });
});

// ── Tally counter ─────────────────────────────────────────────────────────────

describe('MinigameHost — categories tally counter', () => {
  it('increments tally when + Answer is clicked', () => {
    const store = makeCategoriesStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const btn = screen.getByTestId('tally-increment');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.getByTestId('tally-count').textContent).toContain('2');
  });
});

// ── Boost surfacing ───────────────────────────────────────────────────────────

describe('MinigameHost — categories boost (Skip)', () => {
  it('Skip boost surfaces in ACTIVE when charm power-up is held', () => {
    const store = makeCategoriesStore(1, { charmPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-charm')).toBeInTheDocument();
  });

  it('Skip boost preview shown in ARMED when charm power-up is held', () => {
    const store = makeCategoriesStore(1, { charmPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('mg-boost-available-charm')).toBeInTheDocument();
  });

  it('no boost renders when no charm power-up is held', () => {
    const store = makeCategoriesStore(1, { charmPowerUp: false });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('boost-charm')).not.toBeInTheDocument();
  });

  it('Skip fires once then disables', () => {
    const store = makeCategoriesStore(1, { charmPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const btn = screen.getByTestId('boost-charm');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it('Skip resets the tally to 0', () => {
    const store = makeCategoriesStore(1, { charmPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const tallyBtn = screen.getByTestId('tally-increment');
    fireEvent.click(tallyBtn);
    fireEvent.click(tallyBtn);
    expect(screen.getByTestId('tally-count').textContent).toContain('2');

    fireEvent.click(screen.getByTestId('boost-charm'));
    expect(screen.getByTestId('tally-count').textContent).toContain('0');
  });
});

// ── Outcome flow ──────────────────────────────────────────────────────────────

describe('MinigameHost — categories outcome flow', () => {
  it('GM confirms botched → RESOLVE_MINIGAME → phase is offer', () => {
    const store = makeCategoriesStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    // In-game OutcomeJudge
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
    const store = makeCategoriesStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    // In-game OutcomeJudge: pick clean
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
