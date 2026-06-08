// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { ParsedNarration } from '@/content/schema';
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

// ── Narration: pushRun teleprompter ───────────────────────────────────────────

function makeNarrationFixture(): ParsedNarration {
  const variants = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, text: `${prefix} text ${i}` }));
  return {
    briefing: variants('br', 6),
    obstacleClue: variants('oc', 10),
    optionDescription: variants('od', 10),
    pushRun: [
      { id: 'pr-cool-0', text: 'Cool push run A', when: { heatBand: 'cool' } },
      { id: 'pr-cool-1', text: 'Cool push run B', when: { heatBand: 'cool' } },
      { id: 'pr-warm-0', text: 'Warm push run A', when: { heatBand: 'warm' } },
      { id: 'pr-warm-1', text: 'Warm push run B', when: { heatBand: 'warm' } },
      { id: 'pr-hot-0', text: 'Hot push run A', when: { heatBand: 'hot' } },
      { id: 'pr-hot-1', text: 'Hot push run B', when: { heatBand: 'hot' } },
    ],
    outcomeQuip: variants('oq', 18),
    scenarioSetup: variants('ss', 8),
    getawayIntro: variants('gi', 6),
    getawayCountdown: variants('gc', 6),
    winSting: variants('ws', 6),
    bustSting: variants('bs', 6),
    roomApproach: variants('ra', 4),
    scenarioReveal: variants('sr', 4),
  };
}

function makeOfferStoreWithNarration(seed = 1) {
  const narration = makeNarrationFixture();
  const store = createGameStore({ cfg: obstacleOnlyCfg, storage: makeStorage(), narration });
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

  if (store.getState().session.present.phase !== 'offer') {
    throw new Error('Expected offer phase');
  }
  return store;
}

function renderOfferWithNarration(seed = 1) {
  const store = makeOfferStoreWithNarration(seed);
  render(
    <StoreContext.Provider value={store}>
      <Offer />
    </StoreContext.Provider>,
  );
  return store;
}

describe('Offer screen — pushRun narration', () => {
  it('renders push-run-narration container with teleprompter when narration is loaded', () => {
    renderOfferWithNarration();
    expect(screen.getByTestId('push-run-narration')).toBeInTheDocument();
    expect(screen.getByTestId('teleprompter')).toBeInTheDocument();
  });

  it('teleprompter shows a non-empty pushRun line (cool band at low heat)', () => {
    renderOfferWithNarration();
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).not.toBe('');
    // At low heat the band is 'cool' so the variant text starts with 'Cool'
    expect(line).toContain('Cool push run');
  });

  it('advance button re-picks a pushRun line (never disabled)', () => {
    renderOfferWithNarration();
    const btn = screen.getByTestId('teleprompter-advance');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(screen.getByTestId('teleprompter-line')).toBeInTheDocument();
  });

  it('push-on and call-getaway are still reachable regardless of narration state', () => {
    renderOfferWithNarration();
    expect(screen.getByTestId('btn-push-on')).toBeInTheDocument();
    expect(screen.getByTestId('btn-call-getaway')).toBeInTheDocument();
  });

  it('hot heatBand narration selected when heat is at hMax (heat set before render)', () => {
    const narration = makeNarrationFixture();
    const hotStore = createGameStore({ cfg: obstacleOnlyCfg, storage: makeStorage(), narration });
    hotStore.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);

    const room = hotStore.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = hotStore.getState().session.present.crew;
    hotStore.getState().dispatch({
      t: 'CHOOSE_OPTION',
      optionId: room.options[0]!.id,
      committed: [crew[0]!.id],
    });
    hotStore.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
    // Set heat to hMax BEFORE rendering so the useState initializer uses the hot band.
    hotStore.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: testCfg.heat.hMax });

    render(
      <StoreContext.Provider value={hotStore}>
        <Offer />
      </StoreContext.Provider>,
    );
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Hot push run');
  });
});
