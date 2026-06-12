// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import { resolveGameVariant, obstacleCommitRange } from '@/engine';
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

// ── defuseTheAlarm-only EngineConfig ──────────────────────────────────────────

const defuseCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: {
      ...testCfg.scaling.minCommit,
      defuseTheAlarm: 2,
    },
    excludedFromSolo: ['defuseTheAlarm'],
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      defuseTheAlarm: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
    },
    profiles: {
      ...testCfg.scaling.profiles,
      '2': { getawayBonus: -0.04, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'df-vault',
        gameId: 'defuseTheAlarm',
        lane: 'charm',
        options: [
          { id: 'df-safe',  greedy: false, heatCost: 1, reward: 1 },
          { id: 'df-risky', greedy: true,  heatCost: 2, reward: 2 },
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

interface MakeDefuseStoreOpts {
  charmPowerUp?: boolean;
  stealthPowerUp?: boolean;
}

function makeDefuseStore(seed = 1, opts: MakeDefuseStoreOpts = {}) {
  const store = createGameStore({ cfg: defuseCfg, storage: makeStorage() });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);

  const crew = store.getState().session.present.crew;

  if (opts.charmPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: crew[0]!.id, lane: 'charm', held: true });
  }
  if (opts.stealthPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: crew[0]!.id, lane: 'stealth', held: true });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with defuseCfg');
  }

  const committed: PlayerId[] = crew.map(p => p.id);
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed,
  });

  return store;
}

// ── minCommit gate (excluded-from-solo, epic gate) ────────────────────────────

describe('obstacleCommitRange — Defuse never below minCommit 2', () => {
  it('minCrew is 2 for a 2-player run', () => {
    const [minCrew] = obstacleCommitRange('defuseTheAlarm', 2, defuseCfg);
    expect(minCrew).toBeGreaterThanOrEqual(2);
  });

  it('minCrew is 2 for all headcounts 2–7', () => {
    for (const hc of [2, 3, 4, 5, 6, 7]) {
      const [minCrew] = obstacleCommitRange('defuseTheAlarm', hc, defuseCfg);
      expect(minCrew).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('resolveGameVariant — Defuse has no solo variant (excluded)', () => {
  it('returns defuseTheAlarm unchanged at commit 2', () => {
    const resolved = resolveGameVariant('defuseTheAlarm', 2, 4, defuseCfg);
    expect(resolved).toBe('defuseTheAlarm');
  });

  it('returns defuseTheAlarm unchanged at commit 3', () => {
    const resolved = resolveGameVariant('defuseTheAlarm', 3, 5, defuseCfg);
    expect(resolved).toBe('defuseTheAlarm');
  });
});

// ── ARMED state (timer guard) ─────────────────────────────────────────────────

describe('MinigameHost — DefuseTheAlarm ARMED state', () => {
  it('game component not mounted in ARMED — no timer can run on load', () => {
    const store = makeDefuseStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.queryByTestId('defuse-the-alarm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
  });

  it('DialReadout visible in ARMED state', () => {
    const store = makeDefuseStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
  });
});

// ── Component mounting ────────────────────────────────────────────────────────

describe('MinigameHost — defuseTheAlarm mounting', () => {
  it('mounts DefuseComponent after START (not the stub)', () => {
    const store = makeDefuseStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('defuse-the-alarm')).toBeInTheDocument();
    expect(screen.queryByTestId('minigame-stub')).not.toBeInTheDocument();
  });

  it('renders the deal setup panel in ACTIVE', () => {
    const store = makeDefuseStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('defuse-setup')).toBeInTheDocument();
  });

  it('renders a timer once the wires are dealt', () => {
    const store = makeDefuseStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('defuse-dealt'));
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });

  it('renders the GM rulebook reference once the wires are dealt', () => {
    const store = makeDefuseStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('defuse-dealt'));
    expect(screen.getByTestId('defuse-rulebook-gm')).toBeInTheDocument();
  });

  it('renders standard status/challenge/referee zones in ACTIVE', () => {
    const store = makeDefuseStore();
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
    const store = makeDefuseStore();
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

describe('MinigameHost — defuseTheAlarm seeded params stable', () => {
  it('same seed → same deal instructions across two independent stores', () => {
    const storeA = makeDefuseStore(42);
    const { unmount: unmountA } = render(
      <StoreContext.Provider value={storeA}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const setupA = screen.getByTestId('defuse-setup').textContent;
    unmountA();

    const storeB = makeDefuseStore(42);
    render(
      <StoreContext.Provider value={storeB}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const setupB = screen.getByTestId('defuse-setup').textContent;

    expect(setupA).toBe(setupB);
  });
});

// ── Boost surfacing ───────────────────────────────────────────────────────────

describe('MinigameHost — defuseTheAlarm boost surfacing', () => {
  it('Insulated Gloves boost surfaces in ACTIVE when charm power-up is held', () => {
    const store = makeDefuseStore(1, { charmPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-charm')).toBeInTheDocument();
  });

  it('Insulated Gloves surfaces when stealth power-up is held (any-lane eligibility)', () => {
    const store = makeDefuseStore(1, { stealthPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-charm')).toBeInTheDocument();
  });

  it('no boost renders when no power-up is held', () => {
    const store = makeDefuseStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('boost-charm')).not.toBeInTheDocument();
  });

  it('Insulated Gloves fires once then disables', () => {
    const store = makeDefuseStore(1, { charmPowerUp: true });
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

  it('Insulated Gloves shows the armed banner after firing', () => {
    const store = makeDefuseStore(1, { charmPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('defuse-dealt'));
    expect(screen.queryByTestId('defuse-gloves-armed')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('boost-charm'));
    expect(screen.getByTestId('defuse-gloves-armed')).toBeInTheDocument();
  });
});

// ── Wire cutting ──────────────────────────────────────────────────────────────

describe('MinigameHost — defuseTheAlarm GM recording', () => {
  it('recording a safe cut updates the tally', () => {
    const store = makeDefuseStore(1);
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('defuse-dealt'));
    fireEvent.click(screen.getByTestId('defuse-safe-cut'));
    expect(screen.getByTestId('defuse-progress').textContent).toContain('1');
  });
});

// ── Outcome flow ──────────────────────────────────────────────────────────────

describe('MinigameHost — defuseTheAlarm outcome flow', () => {
  it('GM confirms clean → RESOLVE_MINIGAME → phase is offer', () => {
    const store = makeDefuseStore(1);
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    // judge yields complication by default — call outcome
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
    const store = makeDefuseStore(1);
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
