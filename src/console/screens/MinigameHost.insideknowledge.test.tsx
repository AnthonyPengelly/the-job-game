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

// ── inside-knowledge-only EngineConfig ────────────────────────────────────────

const insideKnowledgeCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: { ...testCfg.scaling.minCommit, insideKnowledge: 1 },
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      insideKnowledge: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'knowledge-archive',
        gameId: 'insideKnowledge',
        lane: 'tech',
        options: [
          { id: 'knowledge-careful',  greedy: false, heatCost: 1, reward: 1 },
          { id: 'knowledge-thorough', greedy: true,  heatCost: 2, reward: 2 },
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
  techPowerUp?: boolean;
  charmPowerUp?: boolean;
  twoPlayers?: boolean;
}

function makeInsideKnowledgeStore(seed = 1, opts: MakeStoreOpts = {}) {
  const store = createGameStore({ cfg: insideKnowledgeCfg, storage: makeStorage() });
  const playerSetup = opts.twoPlayers
    ? [{ name: 'Alice' }, { name: 'Bob' }]
    : [{ name: 'Alice' }];
  store.getState().startRun(playerSetup, seed);

  const crew = store.getState().session.present.crew;
  const alice = crew[0]!;

  if (opts.techPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'tech', held: true });
  }
  if (opts.charmPowerUp) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane: 'charm', held: true });
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with insideKnowledgeCfg');
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

describe('MinigameHost — InsideKnowledge ARMED state', () => {
  it('game component not mounted in ARMED — no timer can run on load', () => {
    const store = makeInsideKnowledgeStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.queryByTestId('inside-knowledge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-minigame-start')).toBeInTheDocument();
  });

  it('DialReadout visible in ARMED state', () => {
    const store = makeInsideKnowledgeStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
  });
});

// ── Game mounting ─────────────────────────────────────────────────────────────

describe('MinigameHost — inside-knowledge game mounting', () => {
  it('mounts InsideKnowledgeComponent after START instead of the stub', () => {
    const store = makeInsideKnowledgeStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('inside-knowledge')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-outcome-clean')).not.toBeInTheDocument();
  });

  it('shows tier and first question in ACTIVE', () => {
    const store = makeInsideKnowledgeStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('ik-tier')).toBeInTheDocument();
    expect(screen.getByTestId('ik-question')).toBeInTheDocument();
    expect(screen.getByTestId('ik-answer')).toBeInTheDocument();
  });

  it('shows progress header with score in ACTIVE', () => {
    const store = makeInsideKnowledgeStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('ik-progress')).toBeInTheDocument();
    expect(screen.getByTestId('ik-score')).toBeInTheDocument();
  });

  it('renders standard status/challenge/referee zones in ACTIVE', () => {
    const store = makeInsideKnowledgeStore();
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
    const store = makeInsideKnowledgeStore();
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

describe('MinigameHost — inside-knowledge seeded params stable', () => {
  it('same seed → same first question across two independent stores', () => {
    const storeA = makeInsideKnowledgeStore(42);
    const { unmount: unmountA } = render(
      <StoreContext.Provider value={storeA}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const questionA = screen.getByTestId('ik-question').textContent;
    unmountA();

    const storeB = makeInsideKnowledgeStore(42);
    render(
      <StoreContext.Provider value={storeB}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const questionB = screen.getByTestId('ik-question').textContent;

    expect(questionA).toBe(questionB);
  });
});

// ── Marking questions ─────────────────────────────────────────────────────────

describe('MinigameHost — inside-knowledge question marking', () => {
  it('advances to next question when marked correct', () => {
    const store = makeInsideKnowledgeStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const progressBefore = screen.getByTestId('ik-progress').textContent;
    fireEvent.click(screen.getByTestId('ik-mark-correct'));
    const progressAfter = screen.getByTestId('ik-progress').textContent;
    expect(progressAfter).not.toBe(progressBefore);
  });

  it('advances to next question when marked wrong', () => {
    const store = makeInsideKnowledgeStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    const progressBefore = screen.getByTestId('ik-progress').textContent;
    fireEvent.click(screen.getByTestId('ik-mark-wrong'));
    const progressAfter = screen.getByTestId('ik-progress').textContent;
    expect(progressAfter).not.toBe(progressBefore);
  });
});

// ── Boost surfacing ───────────────────────────────────────────────────────────

describe('MinigameHost — inside-knowledge boosts', () => {
  it('Cheat Sheet boost surfaces in ACTIVE when tech power-up is held', () => {
    const store = makeInsideKnowledgeStore(1, { techPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-tech')).toBeInTheDocument();
  });

  it('Narrow It Down boost surfaces in ACTIVE when charm power-up is held', () => {
    const store = makeInsideKnowledgeStore(1, { charmPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-charm')).toBeInTheDocument();
  });

  it('no boost renders when no power-ups are held', () => {
    const store = makeInsideKnowledgeStore(1);
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.queryByTestId('boost-tech')).not.toBeInTheDocument();
    expect(screen.queryByTestId('boost-charm')).not.toBeInTheDocument();
  });

  it('Cheat Sheet fires once then disables', () => {
    const store = makeInsideKnowledgeStore(1, { techPowerUp: true });
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

  it('Narrow It Down fires once then disables', () => {
    const store = makeInsideKnowledgeStore(1, { charmPowerUp: true });
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

  it('both boosts surface independently when both power-ups are held by two players', () => {
    const store = makeInsideKnowledgeStore(1, { techPowerUp: true, charmPowerUp: true });
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    expect(screen.getByTestId('boost-tech')).toBeInTheDocument();
    expect(screen.getByTestId('boost-charm')).toBeInTheDocument();
  });
});

// ── Outcome flow ──────────────────────────────────────────────────────────────

describe('MinigameHost — inside-knowledge outcome flow', () => {
  it('GM confirms botched → RESOLVE_MINIGAME → phase is offer', () => {
    const store = makeInsideKnowledgeStore();
    render(
      <StoreContext.Provider value={store}>
        <MinigameHost />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-minigame-start'));
    // judge yields botched (0 correct < threshold) — call outcome
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    // Shell RESOLVE pre-selected to botched — confirm
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
    const store = makeInsideKnowledgeStore();
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

    const history = store.getState().session.present.history;
    const last = history[history.length - 1];
    expect(last?.kind).toBe('obstacle');
    if (last?.kind === 'obstacle') {
      expect(last.outcome).toBe('clean');
    }
  });
});
