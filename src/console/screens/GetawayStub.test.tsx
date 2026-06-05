// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { GetawayStub } from './GetawayStub';

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
 * Advance store to getaway phase.
 */
function makeGetawayStore(seed = 1) {
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

  if (store.getState().session.present.phase !== 'getaway') {
    throw new Error('Expected getaway phase');
  }
  return store;
}

function renderGetawayStub(seed = 1) {
  const store = makeGetawayStore(seed);
  render(
    <StoreContext.Provider value={store}>
      <GetawayStub />
    </StoreContext.Provider>,
  );
  return store;
}

// ── GetawayStub tests ─────────────────────────────────────────────────────────

describe('GetawayStub screen', () => {
  it('renders with data-testid screen-getaway', () => {
    renderGetawayStub();
    expect(screen.getByTestId('screen-getaway')).toBeInTheDocument();
  });

  it('shows resolve, win, and bust buttons', () => {
    renderGetawayStub();
    expect(screen.getByTestId('btn-resolve-getaway')).toBeInTheDocument();
    expect(screen.getByTestId('btn-win')).toBeInTheDocument();
    expect(screen.getByTestId('btn-bust')).toBeInTheDocument();
  });

  it('GM win button transitions to result phase with win=true', () => {
    const store = renderGetawayStub();
    fireEvent.click(screen.getByTestId('btn-win'));
    const state = store.getState().session.present;
    expect(state.phase).toBe('result');
    expect(state.win).toBe(true);
  });

  it('GM bust button transitions to result phase with win=false', () => {
    const store = renderGetawayStub();
    fireEvent.click(screen.getByTestId('btn-bust'));
    const state = store.getState().session.present;
    expect(state.phase).toBe('result');
    expect(state.win).toBe(false);
  });

  it('seeded resolve transitions to result phase and produces a finalScore', () => {
    const store = renderGetawayStub();
    fireEvent.click(screen.getByTestId('btn-resolve-getaway'));
    const state = store.getState().session.present;
    expect(state.phase).toBe('result');
    expect(state.finalScore).toBeDefined();
    expect(typeof state.finalScore).toBe('number');
  });

  it('win result includes a positive finalScore', () => {
    const store = renderGetawayStub();
    fireEvent.click(screen.getByTestId('btn-win'));
    const state = store.getState().session.present;
    // loot=1 after clean obstacle; score = loot * (winBase + styleBonus*(1-heat/hMax))
    expect(state.finalScore).toBeGreaterThan(0);
  });

  it('bust result finalScore is loot * bustMultiplier', () => {
    const store = makeGetawayStore();
    // Loot after one clean obstacle is 1 (safe option reward).
    const loot = store.getState().session.present.loot;
    render(
      <StoreContext.Provider value={store}>
        <GetawayStub />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-bust'));
    const state = store.getState().session.present;
    expect(state.finalScore).toBeCloseTo(loot * testCfg.scoring.bustMultiplier, 5);
  });
});
