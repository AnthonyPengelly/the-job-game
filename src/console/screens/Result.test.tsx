// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
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
    <StoreContext.Provider value={store}>
      <Result />
    </StoreContext.Provider>,
  );
  return store;
}

// ── Result tests ──────────────────────────────────────────────────────────────

describe('Result screen', () => {
  it('renders with data-testid screen-result', () => {
    renderResult(true);
    expect(screen.getByTestId('screen-result')).toBeInTheDocument();
  });

  it('shows "Win" outcome when win=true', () => {
    renderResult(true);
    expect(screen.getByTestId('result-outcome')).toHaveTextContent('Win');
  });

  it('shows "Bust" outcome when win=false', () => {
    renderResult(false);
    expect(screen.getByTestId('result-outcome')).toHaveTextContent('Bust');
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

  it('shows "Go Again" button', () => {
    renderResult(true);
    expect(screen.getByTestId('btn-go-again')).toBeInTheDocument();
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
    const expectedScore =
      state.loot *
      (testCfg.scoring.winBaseMultiplier +
        testCfg.scoring.lowHeatStyleBonus * (1 - state.heat / testCfg.heat.hMax));
    render(
      <StoreContext.Provider value={store}>
        <Result />
      </StoreContext.Provider>,
    );
    expect(state.finalScore).toBeCloseTo(expectedScore, 5);
  });

  it('bust final score matches engine scoring formula', () => {
    const store = makeResultStore(false);
    const state = store.getState().session.present;
    const expectedScore = state.loot * testCfg.scoring.bustMultiplier;
    render(
      <StoreContext.Provider value={store}>
        <Result />
      </StoreContext.Provider>,
    );
    expect(state.finalScore).toBeCloseTo(expectedScore, 5);
  });
});
