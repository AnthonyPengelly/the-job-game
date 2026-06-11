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

// ── assemblyLine-only EngineConfig ────────────────────────────────────────────

const assemblyLineCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    profiles: {
      ...testCfg.scaling.profiles,
      '3': { getawayBonus: -0.02, crewPerOption: [2, 3] as [number, number], exhaustion: 'tired' as const },
    },
    minCommit: {
      ...testCfg.scaling.minCommit,
      assemblyLine: 2,
      assemblyLineNegotiated: 2,
    },
    variant: {
      assemblyLine: { variantId: 'assemblyLineNegotiated', appliesAt: [2] },
    },
    excludedFromSolo: ['assemblyLine'],
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      assemblyLine: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
      assemblyLineNegotiated: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'al-storeroom',
        gameId: 'assemblyLine',
        lane: 'physical',
        options: [
          { id: 'al-safe',  greedy: false, heatCost: 1, reward: 1 },
          { id: 'al-risky', greedy: true,  heatCost: 2, reward: 2 },
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

interface MakeStoreOpts {
  players: { name: string }[];
  commitAll?: boolean;
  physicalPowerUp?: boolean;
  charmPowerUp?: boolean;
}

function makeAssemblyLineStore(seed = 1, opts: MakeStoreOpts) {
  const store = createGameStore({ cfg: assemblyLineCfg, storage: makeStorage() });
  store.getState().startRun(opts.players, seed);

  const crew = store.getState().session.present.crew;

  if (opts.physicalPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: crew[0]!.id, lane: 'physical', held: true });
  }
  if (opts.charmPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: crew[0]!.id, lane: 'charm', held: true });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with assemblyLineCfg');
  }

  const committed: PlayerId[] = opts.commitAll !== false
    ? crew.map(p => p.id)
    : [crew[0]!.id, crew[1]!.id];

  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed,
  });

  return store;
}

// ── Variant resolution (epic gate) ────────────────────────────────────────────

describe('resolveGameVariant — Assembly Line variant loading', () => {
  it('loads assemblyLineNegotiated at commit size 2', () => {
    const resolved = resolveGameVariant('assemblyLine', 2, 3, assemblyLineCfg);
    expect(resolved).toBe('assemblyLineNegotiated');
  });

  it('loads assemblyLine (parent) at commit size 3', () => {
    const resolved = resolveGameVariant('assemblyLine', 3, 5, assemblyLineCfg);
    expect(resolved).toBe('assemblyLine');
  });

  it('loads assemblyLine (parent) at commit size 4', () => {
    const resolved = resolveGameVariant('assemblyLine', 4, 6, assemblyLineCfg);
    expect(resolved).toBe('assemblyLine');
  });
});

// ── minCommit gate (epic gate) ────────────────────────────────────────────────

describe('obstacleCommitRange — Assembly Line never below minCommit 2', () => {
  it('minCrew is 2 for a 2-player run', () => {
    const [minCrew] = obstacleCommitRange('assemblyLine', 2, assemblyLineCfg);
    expect(minCrew).toBeGreaterThanOrEqual(2);
  });

  it('minCrew is 2 for a 3-player run', () => {
    const [minCrew] = obstacleCommitRange('assemblyLine', 3, assemblyLineCfg);
    expect(minCrew).toBeGreaterThanOrEqual(2);
  });

  it('minCrew is 2 for all headcounts 2–7', () => {
    for (const hc of [2, 3, 4, 5, 6, 7]) {
      const [minCrew] = obstacleCommitRange('assemblyLine', hc, assemblyLineCfg);
      expect(minCrew).toBeGreaterThanOrEqual(2);
    }
  });
});

// ── ARMED state (timer guard) ─────────────────────────────────────────────────

describe('MinigameHost — AssemblyLine ARMED state', () => {
  it('game component not mounted in ARMED — no timer can run on load', () => {
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.queryByTestId('assembly-line-negotiated')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
  });

  it('DialReadout visible in ARMED state', () => {
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
  });
});

// ── assemblyLineNegotiated mounts at commit 2 ─────────────────────────────────

describe('MinigameHost — assemblyLineNegotiated (commit 2)', () => {
  it('mounts AssemblyLineNegotiatedComponent after START (not the stub)', () => {
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('assembly-line-negotiated')).toBeInTheDocument();
    expect(screen.queryByTestId('assembly-line')).not.toBeInTheDocument();
  });

  it('shows hand size and the GM setup panel in ACTIVE', () => {
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('aln-hand-size')).toBeInTheDocument();
    expect(screen.getByTestId('aln-setup')).toBeInTheDocument();
  });

  it('shows a timer once hands are dealt', () => {
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('aln-dealt'));
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });

  it('renders standard status/challenge/referee zones in ACTIVE', () => {
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
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

  it('Call Outcome button is present in ACTIVE (negotiated)', () => {
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('btn-call-outcome')).toBeInTheDocument();
  });
});

// ── assemblyLine (parent) mounts at commit 3 ─────────────────────────────────

describe('MinigameHost — assemblyLine (commit 3)', () => {
  it('mounts AssemblyLineComponent after START (not the stub or negotiated)', () => {
    const store = makeAssemblyLineStore(1, {
      players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }],
    });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('assembly-line')).toBeInTheDocument();
    expect(screen.queryByTestId('assembly-line-negotiated')).not.toBeInTheDocument();
  });
});

// ── Seeded params reproducibility ─────────────────────────────────────────────

describe('MinigameHost — seeded params stable', () => {
  it('same seed → same hand size for the negotiated variant', () => {
    const storeA = makeAssemblyLineStore(42, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
    const { unmount: unmountA } = render(
      <StoreContext.Provider value={storeA}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const handA = screen.getByTestId('aln-hand-size').textContent;
    unmountA();

    const storeB = makeAssemblyLineStore(42, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
    render(
      <StoreContext.Provider value={storeB}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const handB = screen.getByTestId('aln-hand-size').textContent;

    expect(handA).toBe(handB);
  });
});

// ── Boost surfacing ───────────────────────────────────────────────────────────

describe('MinigameHost — assemblyLineNegotiated boost surfacing', () => {
  it('Tip-Off boost surfaces in ACTIVE when charm power-up is held', () => {
    const store = makeAssemblyLineStore(1, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      charmPowerUp: true,
    });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-charm')).toBeInTheDocument();
  });

  it('Tip-Off surfaces when physical power-up is held (any-lane eligibility)', () => {
    const store = makeAssemblyLineStore(1, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      physicalPowerUp: true,
    });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-charm')).toBeInTheDocument();
  });

  it('no boost renders when no power-up is held', () => {
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('boost-charm')).not.toBeInTheDocument();
  });

  it('Tip-Off boost fires once then disables', () => {
    const store = makeAssemblyLineStore(1, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      charmPowerUp: true,
    });
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

  it('Tip-Off reveals set types after firing', () => {
    const store = makeAssemblyLineStore(1, {
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      charmPowerUp: true,
    });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    fireEvent.click(screen.getByTestId('aln-dealt'));
    expect(screen.queryByTestId('aln-types-revealed')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('boost-charm'));
    expect(screen.getByTestId('aln-types-revealed')).toBeInTheDocument();
  });
});

// ── Outcome flow ──────────────────────────────────────────────────────────────

describe('MinigameHost — assemblyLineNegotiated outcome flow', () => {
  it('GM confirms clean → RESOLVE_MINIGAME → phase is offer', () => {
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
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
    const store = makeAssemblyLineStore(1, { players: [{ name: 'Alice' }, { name: 'Bob' }] });
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
