// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import { resolveGameVariant } from '@/engine';
import type { EngineConfig, PlayerId } from '@/engine';
import type { StorageLike } from '@/platform';
import { MinigameHost } from './MinigameHost';

afterEach(cleanup);

// ── Shared EngineConfig ───────────────────────────────────────────────────────

const crackCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: {
      ...testCfg.scaling.minCommit,
      crackTheTumblers: 1,
    },
    variant: {
      crackTheTumblers: { soloVariantId: 'crackTheTumblersSolo', appliesAt: [1] },
    },
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      crackTheTumblers: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
      crackTheTumblersSolo: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'tumblers-vault',
        gameId: 'crackTheTumblers',
        lane: 'tech',
        options: [
          { id: 'crack-safe', greedy: false, heatCost: 1, reward: 1 },
          { id: 'crack-risky', greedy: true, heatCost: 2, reward: 2 },
        ],
      },
    ],
  },
};

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

interface MakeStoreOpts {
  twoPlayers?: boolean;
  techPowerUp?: boolean;
}

function makeCrackStore(seed = 1, opts: MakeStoreOpts = {}) {
  const store = createGameStore({ cfg: crackCfg, storage: makeStorage() });
  const playerSetup = opts.twoPlayers
    ? [{ name: 'Alice' }, { name: 'Bob' }]
    : [{ name: 'Alice' }];
  store.getState().startRun(playerSetup, seed);

  const crew = store.getState().session.present.crew;
  const alice = crew[0]!;

  if (opts.techPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'tech', held: true });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with crackCfg');
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

// ── Variant resolution (epic gate) ────────────────────────────────────────────

describe('resolveGameVariant — Crack the Tumblers variant loading', () => {
  it('loads crackTheTumblersSolo at commit size 1', () => {
    const resolved = resolveGameVariant('crackTheTumblers', 1, 3, crackCfg);
    expect(resolved).toBe('crackTheTumblersSolo');
  });

  it('loads crackTheTumblers (parent) at commit size 2', () => {
    const resolved = resolveGameVariant('crackTheTumblers', 2, 3, crackCfg);
    expect(resolved).toBe('crackTheTumblers');
  });

  it('loads crackTheTumblers (parent) at commit size 3', () => {
    const resolved = resolveGameVariant('crackTheTumblers', 3, 5, crackCfg);
    expect(resolved).toBe('crackTheTumblers');
  });
});

// ── ARMED state (timer guard) ─────────────────────────────────────────────────

describe('MinigameHost — CrackTheTumblers ARMED state', () => {
  it('game component not mounted in ARMED — no timer can run', () => {
    const store = makeCrackStore(1, { twoPlayers: false });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.queryByTestId('crack-the-tumblers-solo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crack-the-tumblers')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
  });

  it('DialReadout visible in ARMED state (GM sees difficulty before START)', () => {
    const store = makeCrackStore(1, { twoPlayers: false });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
  });
});

// ── Solo run: crackTheTumblersSolo mounts ─────────────────────────────────────

describe('MinigameHost — crackTheTumblersSolo (commit 1)', () => {
  it('mounts CrackTheTumblersSolo component after START (not the stub)', () => {
    const store = makeCrackStore(1, { twoPlayers: false });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('crack-the-tumblers-solo')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-outcome-clean')).not.toBeInTheDocument();
  });

  it('GM can confirm botched outcome → RESOLVE_MINIGAME → phase is offer', () => {
    const store = makeCrackStore(1, { twoPlayers: false });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    // In-game OutcomeJudge: pick botched and confirm
    fireEvent.click(screen.getByTestId('outcome-option-botched'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));
    // Shell RESOLVE: pre-selected to botched, confirm to dispatch
    fireEvent.click(screen.getByTestId('outcome-confirm'));

    expect(store.getState().session.present.phase).toBe('offer');
    const history = store.getState().session.present.history;
    const last = history[history.length - 1];
    expect(last?.kind).toBe('obstacle');
    if (last?.kind === 'obstacle') {
      expect(last.outcome).toBe('botched');
    }
  });
});

// ── Two-player run: crackTheTumblers (parent) mounts ─────────────────────────

describe('MinigameHost — crackTheTumblers (commit 2)', () => {
  it('mounts CrackTheTumblers component after START (not the stub or solo)', () => {
    const store = makeCrackStore(1, { twoPlayers: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('crack-the-tumblers')).toBeInTheDocument();
    expect(screen.queryByTestId('crack-the-tumblers-solo')).not.toBeInTheDocument();
  });

  it('Reset Pin boost surfaces in ACTIVE when the Tech power-up is held', () => {
    const store = makeCrackStore(1, { twoPlayers: true, techPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-tech')).toBeInTheDocument();
  });

  it('Reset Pin boost preview shown in ARMED when Tech power-up is held', () => {
    const store = makeCrackStore(1, { twoPlayers: true, techPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    // ARMED state shows boost-holder preview
    expect(screen.getByTestId('mg-boost-available-tech')).toBeInTheDocument();
  });

  it('Reset Pin fires once then disables', () => {
    const store = makeCrackStore(1, { twoPlayers: true, techPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const btn = screen.getByTestId('boost-tech');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it('no boost renders when no Tech power-up is held', () => {
    const store = makeCrackStore(1, { twoPlayers: true, techPowerUp: false });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('boost-tech')).not.toBeInTheDocument();
  });

  it('GM confirm clean → RESOLVE_MINIGAME → recorded as clean', () => {
    const store = makeCrackStore(1, { twoPlayers: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    // In-game OutcomeJudge
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

// ── Seeded params reproducibility ─────────────────────────────────────────────

describe('MinigameHost — seeded params stable', () => {
  it('same seed → same card count across two independent stores (solo)', () => {
    const storeA = makeCrackStore(42, { twoPlayers: false });
    const { unmount: unmountA } = render(
      <StoreContext.Provider value={storeA}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const countA = screen.getByTestId('ctt-solo-phase').textContent;
    unmountA();

    const storeB = makeCrackStore(42, { twoPlayers: false });
    render(
      <StoreContext.Provider value={storeB}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const countB = screen.getByTestId('ctt-solo-phase').textContent;

    expect(countA).toBe(countB);
  });
});
