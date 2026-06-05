// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { Offer } from './Offer';

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
 * Advance a store from start → offer phase via obstacle→minigame→resolve.
 * Returns the store already in the offer phase.
 */
function makeOfferStore(seed = 1) {
  const store = createGameStore({ cfg: obstacleOnlyCfg, storage: makeStorage() });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with obstacleOnlyCfg');
  }
  const crew = store.getState().session.present.crew;
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed: [crew[0]!.id],
  });
  store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });

  // Should now be in offer phase.
  if (store.getState().session.present.phase !== 'offer') {
    throw new Error('Expected offer phase after RESOLVE_MINIGAME');
  }
  return store;
}

function renderOffer(seed = 1) {
  const store = makeOfferStore(seed);
  render(
    <StoreContext.Provider value={store}>
      <Offer />
    </StoreContext.Provider>,
  );
  return store;
}

// ── Offer tests ───────────────────────────────────────────────────────────────

describe('Offer screen', () => {
  it('renders with data-testid screen-offer', () => {
    renderOffer();
    expect(screen.getByTestId('screen-offer')).toBeInTheDocument();
  });

  it('shows push-on and call-getaway buttons', () => {
    renderOffer();
    expect(screen.getByTestId('btn-push-on')).toBeInTheDocument();
    expect(screen.getByTestId('btn-call-getaway')).toBeInTheDocument();
  });

  it('does NOT show escape-signal hint when escapeSignal is false', () => {
    // At heat=1 with hMax=20 and runAtFraction=0.55, escapeSignal is false.
    renderOffer();
    expect(screen.queryByTestId('escape-signal-hint')).toBeNull();
  });

  it('shows the escape-signal hint exactly when escapeSignal is true', () => {
    // escapeSignal requires roomIndex >= 2 AND heat >= runAtFraction * hMax.
    // Advance through 3 rooms so roomIndex reaches 2, then set heat to threshold.
    const store = createGameStore({ cfg: obstacleOnlyCfg, storage: makeStorage() });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);

    function completeObstacle() {
      const s = store.getState();
      const room = s.session.present.currentRoom;
      if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
      const crew = s.session.present.crew;
      s.dispatch({ t: 'CHOOSE_OPTION', optionId: room.options[0]!.id, committed: [crew[0]!.id] });
      store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
    }

    // Room 0 → offer
    completeObstacle();
    // offer → room 1
    store.getState().dispatch({ t: 'PUSH_ON' });
    // Room 1 → offer
    completeObstacle();
    // offer → room 2
    store.getState().dispatch({ t: 'PUSH_ON' });
    // Room 2 → offer at roomIndex=2
    completeObstacle();

    // Now roomIndex=2; set heat above the run-at threshold (0.55 * 20 = 11).
    store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 11 });
    expect(store.getState().session.present.escapeSignal).toBe(true);

    render(
      <StoreContext.Provider value={store}>
        <Offer />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('escape-signal-hint')).toBeInTheDocument();
  });

  it('push-on advances to the next room (room phase)', () => {
    const store = renderOffer();
    fireEvent.click(screen.getByTestId('btn-push-on'));
    expect(store.getState().session.present.phase).toBe('room');
  });

  it('call-getaway transitions to the getaway phase', () => {
    const store = renderOffer();
    fireEvent.click(screen.getByTestId('btn-call-getaway'));
    expect(store.getState().session.present.phase).toBe('getaway');
  });

  it('push-on at heat=HMAX forces the engine into getaway (no dead-end)', () => {
    const store = makeOfferStore();
    // Override heat to HMAX (20) — engine's forcedGetaway triggers on PUSH_ON.
    store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: testCfg.heat.hMax });
    render(
      <StoreContext.Provider value={store}>
        <Offer />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('btn-push-on'));
    // Engine routes to getaway instead of another room.
    expect(store.getState().session.present.phase).toBe('getaway');
  });
});
