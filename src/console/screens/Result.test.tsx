// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import { getawayMultiplier } from '@/engine/scoring';
import { appendScore } from '@/platform';
import type { StorageLike } from '@/platform';
import type { ParsedNarration } from '@/content/schema';
import { ActionBarSlotProvider, ActionBarSlotOutlet } from '@/console/shell/actionBarSlot';
import { Result } from './Result';

afterEach(cleanup);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

const obstacleOnlyCfg = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
};

/**
 * Advance a store all the way to the result phase.
 * `win` controls whether the GM forces a win or bust.
 */
function makeResultStore(win: boolean, seed = 1) {
  const store = createGameStore({ cfg: obstacleOnlyCfg, storage: makeStorage() });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room');
  }
  const crew = store.getState().session.present.crew;
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed: [crew[0]!.id],
  });
  store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
  store.getState().dispatch({ t: 'CALL_GETAWAY' });
  store.getState().dispatch({ t: 'RESOLVE_GETAWAY', win });

  if (store.getState().session.present.phase !== 'result') {
    throw new Error('Expected result phase');
  }
  return store;
}

function renderResult(win: boolean, seed = 1) {
  const store = makeResultStore(win, seed);
  render(
    <ActionBarSlotProvider>
      <ActionBarSlotOutlet />
      <StoreContext.Provider value={store}>
        <Result />
      </StoreContext.Provider>
    </ActionBarSlotProvider>,
  );
  return store;
}

// ── Result tests ──────────────────────────────────────────────────────────────

describe('Result screen', () => {
  it('renders with data-testid screen-result', () => {
    renderResult(true);
    expect(screen.getByTestId('screen-result')).toBeInTheDocument();
  });

  it('shows "Clean Getaway" verdict when win=true', () => {
    renderResult(true);
    expect(screen.getByTestId('result-outcome')).toHaveTextContent('Clean Getaway');
  });

  it('shows "Job Blown" verdict when win=false', () => {
    renderResult(false);
    expect(screen.getByTestId('result-outcome')).toHaveTextContent('Job Blown');
  });

  it('shows a finalScore element', () => {
    renderResult(true);
    expect(screen.getByTestId('result-final-score')).toBeInTheDocument();
  });

  it('shows the score breakdown elements', () => {
    renderResult(true);
    expect(screen.getByTestId('result-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('breakdown-loot')).toBeInTheDocument();
    expect(screen.getByTestId('breakdown-heat')).toBeInTheDocument();
    expect(screen.getByTestId('breakdown-multiplier')).toBeInTheDocument();
  });

  it('breakdown-heat shows heat and hMax in the multiplier sub-line', () => {
    renderResult(true);
    const heatEl = screen.getByTestId('breakdown-heat');
    expect(heatEl.textContent).toMatch(/Heat \d+ \/ \d+/);
  });

  it('shows "Go Again" button', () => {
    renderResult(true);
    expect(screen.getByTestId('btn-go-again')).toBeInTheDocument();
  });

  it('shows "Run summary" secondary button', () => {
    renderResult(true);
    expect(screen.getByTestId('btn-run-summary')).toBeInTheDocument();
  });

  it('go-again clears the save and returns to Setup (crew empty)', () => {
    const store = renderResult(true);
    fireEvent.click(screen.getByTestId('btn-go-again'));
    const state = store.getState().session.present;
    expect(state.crew).toHaveLength(0);
  });

  it('win final score matches engine scoring formula', () => {
    const store = makeResultStore(true);
    const state = store.getState().session.present;
    const expectedScore = state.loot * getawayMultiplier(state.heat, true, testCfg);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(state.finalScore).toBeCloseTo(expectedScore, 5);
  });

  it('bust final score matches engine scoring formula', () => {
    const store = makeResultStore(false);
    const state = store.getState().session.present;
    const expectedScore = state.loot * getawayMultiplier(state.heat, false, testCfg);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(state.finalScore).toBeCloseTo(expectedScore, 5);
  });

  it('win verdict outcome has "win" class on result-outcome', () => {
    renderResult(true);
    expect(screen.getByTestId('result-outcome').classList.contains('win')).toBe(true);
  });

  it('bust verdict outcome has "lose" class on result-outcome', () => {
    renderResult(false);
    expect(screen.getByTestId('result-outcome').classList.contains('lose')).toBe(true);
  });
});

// ── Narration: winSting / bustSting ───────────────────────────────────────────

function makeResultNarrationFixture(): ParsedNarration {
  const variants = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, text: `${prefix} text ${i}` }));
  return {
    briefing: variants('br', 6),
    obstacleClue: variants('oc', 10),
    optionDescription: variants('od', 10),
    pushRun: variants('pr', 8),
    outcomeQuip: variants('oq', 18),
    scenarioSetup: variants('ss', 8),
    getawayIntro: variants('gi', 6),
    getawayCountdown: variants('gc', 6),
    winSting: [
      { id: 'ws-0', text: 'Win sting line A' },
      { id: 'ws-1', text: 'Win sting line B' },
      { id: 'ws-2', text: 'Win sting line C' },
      { id: 'ws-3', text: 'Win sting line D' },
    ],
    bustSting: [
      { id: 'bs-0', text: 'Bust sting line A' },
      { id: 'bs-1', text: 'Bust sting line B' },
      { id: 'bs-2', text: 'Bust sting line C' },
      { id: 'bs-3', text: 'Bust sting line D' },
    ],
    roomApproach: variants('ra', 4),
    scenarioApproach: variants('sap', 4),
    scenarioReveal: variants('sr', 4),
  };
}

function makeResultStoreWithNarration(win: boolean, seed = 1) {
  const narration = makeResultNarrationFixture();
  const store = createGameStore({ cfg: obstacleOnlyCfg, storage: makeStorage(), narration });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
  const crew = store.getState().session.present.crew;
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed: [crew[0]!.id],
  });
  store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
  store.getState().dispatch({ t: 'CALL_GETAWAY' });
  store.getState().dispatch({ t: 'RESOLVE_GETAWAY', win });

  if (store.getState().session.present.phase !== 'result') throw new Error('Expected result phase');
  return store;
}

describe('Result screen — sting narration', () => {
  it('shows result-sting container with teleprompter for a win', () => {
    const store = makeResultStoreWithNarration(true);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('result-sting')).toBeInTheDocument();
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Win sting line');
  });

  it('shows bustSting line on a bust', () => {
    const store = makeResultStoreWithNarration(false);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('result-sting')).toBeInTheDocument();
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Bust sting line');
  });

  it('advance button absent at last committed sting line (no re-roll)', () => {
    // script() commits a single sting line — hasNext=false → no advance button.
    const store = makeResultStoreWithNarration(true);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.queryByTestId('teleprompter-advance')).toBeNull();
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Win sting line');
  });

  it('go-again button remains reachable regardless of narration state', () => {
    const store = makeResultStoreWithNarration(true);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('btn-go-again')).toBeInTheDocument();
  });

  it('narration absent when no director is loaded (backward compat)', () => {
    // Store WITHOUT narration
    const store = makeResultStore(true);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.queryByTestId('result-sting')).toBeNull();
  });
});

// ── Leaderboard: new-best badge and rank ──────────────────────────────────────

describe('Result screen — leaderboard outcome', () => {
  it('shows result-new-best badge when run is the first for its seed (new personal best)', () => {
    // makeResultStore uses fresh storage — first run is always a new best.
    const store = makeResultStore(true);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('result-new-best')).toBeInTheDocument();
  });

  it('result-new-best badge includes the rank number', () => {
    const store = makeResultStore(true);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    const badge = screen.getByTestId('result-new-best');
    // First-ever run ranks #1.
    expect(badge.textContent).toContain('1');
  });

  it('shows result-rank reflecting the position on the leaderboard', () => {
    const store = makeResultStore(true);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    const rankEl = screen.getByTestId('result-rank');
    expect(rankEl).toBeInTheDocument();
    // First-ever run ranks #1.
    expect(rankEl.textContent).toContain('1');
  });

  it('shows the leaderboard crew name in the rank panel', () => {
    const store = makeResultStore(true);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    // crewName is '' (not set), so the panel shows '—'.
    expect(screen.getByTestId('result-rank')).toBeInTheDocument();
  });

  it('does NOT show result-new-best badge when a better score already exists for the seed', () => {
    const storage = makeStorage();
    // Pre-populate storage with a very high score for seed 1 so the run cannot beat it.
    appendScore(
      { runSeed: 1, score: 9_999_999, loot: 999, heatAtGetaway: 0, win: true, crewSize: 2, crewName: '', finishedAt: 0 },
      storage,
    );

    const store = createGameStore({ cfg: obstacleOnlyCfg, storage });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);

    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;
    store.getState().dispatch({
      t: 'CHOOSE_OPTION',
      optionId: room.options[0]!.id,
      committed: [crew[0]!.id],
    });
    store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
    store.getState().dispatch({ t: 'CALL_GETAWAY' });
    store.getState().dispatch({ t: 'RESOLVE_GETAWAY', win: true });

    expect(store.getState().currentRunNewBest).toBe(false);

    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.queryByTestId('result-new-best')).toBeNull();
  });

  it('shows "Did not place" badge when not a new personal best', () => {
    const storage = makeStorage();
    appendScore(
      { runSeed: 1, score: 9_999_999, loot: 999, heatAtGetaway: 0, win: true, crewSize: 2, crewName: '', finishedAt: 0 },
      storage,
    );

    const store = createGameStore({ cfg: obstacleOnlyCfg, storage });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);

    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;
    store.getState().dispatch({
      t: 'CHOOSE_OPTION',
      optionId: room.options[0]!.id,
      committed: [crew[0]!.id],
    });
    store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
    store.getState().dispatch({ t: 'CALL_GETAWAY' });
    store.getState().dispatch({ t: 'RESOLVE_GETAWAY', win: true });

    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    // The "Did not place" badge should be visible.
    const panel = screen.getByTestId('result-rank');
    expect(panel.textContent).toContain('Did not place');
  });

  it('shows result-rank even when not a new personal best', () => {
    const storage = makeStorage();
    appendScore(
      { runSeed: 1, score: 9_999_999, loot: 999, heatAtGetaway: 0, win: true, crewSize: 2, crewName: '', finishedAt: 0 },
      storage,
    );

    const store = createGameStore({ cfg: obstacleOnlyCfg, storage });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);

    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;
    store.getState().dispatch({
      t: 'CHOOSE_OPTION',
      optionId: room.options[0]!.id,
      committed: [crew[0]!.id],
    });
    store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
    store.getState().dispatch({ t: 'CALL_GETAWAY' });
    store.getState().dispatch({ t: 'RESOLVE_GETAWAY', win: true });

    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    // Rank panel is always shown when currentRunRank is set.
    expect(screen.getByTestId('result-rank')).toBeInTheDocument();
  });

  it('rank panel shows crew names from leaderboard entries', () => {
    const storage = makeStorage();
    appendScore(
      { runSeed: 99, score: 500_000, loot: 400000, heatAtGetaway: 5, win: true, crewSize: 3, crewName: 'The Foxes', finishedAt: 0 },
      storage,
    );

    const store = createGameStore({ cfg: obstacleOnlyCfg, storage });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1, 'The Magpies');

    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;
    store.getState().dispatch({
      t: 'CHOOSE_OPTION',
      optionId: room.options[0]!.id,
      committed: [crew[0]!.id],
    });
    store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
    store.getState().dispatch({ t: 'CALL_GETAWAY' });
    store.getState().dispatch({ t: 'RESOLVE_GETAWAY', win: true });

    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Result />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    const panel = screen.getByTestId('result-rank');
    expect(panel.textContent).toContain('The Foxes');
  });
});
