// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import { getawayBrief } from '@/engine';
import type { StorageLike } from '@/platform';
import { Getaway } from './Getaway';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

/** Short-timer variant used for timer-expiry tests so we don't loop 90 times. */
const shortTimerCfg = {
  ...obstacleOnlyCfg,
  getaway: {
    ...obstacleOnlyCfg.getaway,
    brief: {
      lowHeat:  { heat: 0,  targetCards: 5, timerSeconds: 3 },
      highHeat: { heat: 20, targetCards: 12, timerSeconds: 2 },
    },
  },
};

/** Advance fake time 1 s at a time, flushing React between each tick. */
function tickSeconds(n: number) {
  for (let i = 0; i < n; i++) {
    act(() => { vi.advanceTimersByTime(1000); });
  }
}

/**
 * Advance store to getaway phase.
 * heat=0 by default (gives generous brief: 5 cards, 90s per testCfg).
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

function makeGetawayStoreWithCfg(cfg: typeof obstacleOnlyCfg, seed = 1) {
  const store = createGameStore({ cfg, storage: makeStorage() });
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

/**
 * Advance store to getaway at a specific heat level by overriding after entering getaway.
 */
function makeGetawayStoreAtHeat(heat: number) {
  const store = makeGetawayStore();
  store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: heat });
  return store;
}

function renderGetaway(store = makeGetawayStore()) {
  render(
    <StoreContext.Provider value={store}>
      <Getaway />
    </StoreContext.Provider>,
  );
  return store;
}

// ── Basic rendering ────────────────────────────────────────────────────────────

describe('Getaway screen', () => {
  it('renders with data-testid screen-getaway', () => {
    renderGetaway();
    expect(screen.getByTestId('screen-getaway')).toBeInTheDocument();
  });

  it('shows target cards from brief', () => {
    const store = makeGetawayStore();
    const heat = store.getState().session.present.heat;
    const brief = getawayBrief(heat, obstacleOnlyCfg);
    renderGetaway(store);
    expect(screen.getByTestId('target-cards').textContent).toBe(String(brief.targetCards));
  });

  it('shows cards-cleared readout starting at 0', () => {
    renderGetaway();
    expect(screen.getByTestId('cards-cleared').textContent).toContain('0');
  });

  it('shows clue-giver starting with first crew member', () => {
    renderGetaway();
    expect(screen.getByTestId('clue-giver').textContent).toBe('Alice');
  });

  it('shows timer display with initial seconds from brief', () => {
    const store = makeGetawayStore();
    const heat = store.getState().session.present.heat;
    const brief = getawayBrief(heat, obstacleOnlyCfg);
    renderGetaway(store);
    const timerEl = screen.getByTestId('timer-display');
    expect(timerEl.getAttribute('data-remaining')).toBe(String(brief.timerSeconds));
  });

  it('shows all required buttons', () => {
    renderGetaway();
    expect(screen.getByTestId('btn-toggle-timer')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cleared')).toBeInTheDocument();
    expect(screen.getByTestId('btn-ditch')).toBeInTheDocument();
    expect(screen.getByTestId('btn-skip-card')).toBeInTheDocument();
    expect(screen.getByTestId('btn-buy-seconds')).toBeInTheDocument();
    expect(screen.getByTestId('btn-force-win')).toBeInTheDocument();
    expect(screen.getByTestId('btn-force-bust')).toBeInTheDocument();
  });
});

// ── Resolution paths ───────────────────────────────────────────────────────────

describe('Getaway resolution', () => {
  it('clearing target cards dispatches RESOLVE_GETAWAY { win: true } → result phase', () => {
    const store = renderGetaway();
    const brief = getawayBrief(
      store.getState().session.present.heat,
      store.getState().cfg,
    );
    for (let i = 0; i < brief.targetCards; i++) {
      fireEvent.click(screen.getByTestId('btn-cleared'));
    }
    const state = store.getState().session.present;
    expect(state.phase).toBe('result');
    expect(state.win).toBe(true);
  });

  it('clearing target cards results in a positive finalScore', () => {
    const store = renderGetaway();
    const brief = getawayBrief(
      store.getState().session.present.heat,
      store.getState().cfg,
    );
    for (let i = 0; i < brief.targetCards; i++) {
      fireEvent.click(screen.getByTestId('btn-cleared'));
    }
    expect(store.getState().session.present.finalScore).toBeGreaterThan(0);
  });

  it('timer expiry dispatches RESOLVE_GETAWAY { win: false } → result phase', () => {
    vi.useFakeTimers();
    // Use short timer (3s) so we only need 4 ticks.
    const store = makeGetawayStoreWithCfg(shortTimerCfg);
    renderGetaway(store);
    const brief = getawayBrief(
      store.getState().session.present.heat,
      store.getState().cfg,
    );

    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    // Tick through all seconds + 1 extra to trigger the 0 branch.
    tickSeconds(brief.timerSeconds + 1);

    const state = store.getState().session.present;
    expect(state.phase).toBe('result');
    expect(state.win).toBe(false);
  });

  it('timer expiry score is loot * bustMultiplier', () => {
    vi.useFakeTimers();
    const store = makeGetawayStoreWithCfg(shortTimerCfg);
    const loot = store.getState().session.present.loot;
    renderGetaway(store);
    const brief = getawayBrief(
      store.getState().session.present.heat,
      store.getState().cfg,
    );

    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    tickSeconds(brief.timerSeconds + 1);

    const state = store.getState().session.present;
    expect(state.finalScore).toBeCloseTo(
      loot * shortTimerCfg.scoring.bustMultiplier,
      5,
    );
  });

  it('force win button dispatches RESOLVE_GETAWAY { win: true }', () => {
    const store = renderGetaway();
    fireEvent.click(screen.getByTestId('btn-force-win'));
    const state = store.getState().session.present;
    expect(state.phase).toBe('result');
    expect(state.win).toBe(true);
  });

  it('force bust button dispatches RESOLVE_GETAWAY { win: false }', () => {
    const store = renderGetaway();
    fireEvent.click(screen.getByTestId('btn-force-bust'));
    const state = store.getState().session.present;
    expect(state.phase).toBe('result');
    expect(state.win).toBe(false);
  });
});

// ── Round actions ──────────────────────────────────────────────────────────────

describe('Getaway round actions', () => {
  it('cleared increments cards-cleared display', () => {
    renderGetaway();
    fireEvent.click(screen.getByTestId('btn-cleared'));
    expect(screen.getByTestId('cards-cleared').textContent).toContain('1');
  });

  it('cleared advances clue-giver to next crew member', () => {
    renderGetaway();
    expect(screen.getByTestId('clue-giver').textContent).toBe('Alice');
    fireEvent.click(screen.getByTestId('btn-cleared'));
    expect(screen.getByTestId('clue-giver').textContent).toBe('Bob');
  });

  it('ditch dispatches GETAWAY_DITCH (raises Heat)', () => {
    const store = renderGetaway();
    const heatBefore = store.getState().session.present.heat;
    fireEvent.click(screen.getByTestId('btn-ditch'));
    const heatAfter = store.getState().session.present.heat;
    expect(heatAfter).toBe(heatBefore + obstacleOnlyCfg.getaway.ditchHeatCost);
  });

  it('ditch advances clue-giver without incrementing cards-cleared', () => {
    renderGetaway();
    const beforeText = screen.getByTestId('cards-cleared').textContent ?? '';
    expect(beforeText).toContain('0');
    fireEvent.click(screen.getByTestId('btn-ditch'));
    expect(screen.getByTestId('clue-giver').textContent).toBe('Bob');
    expect(screen.getByTestId('cards-cleared').textContent).toContain('0');
  });

  it('ditch is undoable via store undo', () => {
    const store = renderGetaway();
    const heatBefore = store.getState().session.present.heat;
    fireEvent.click(screen.getByTestId('btn-ditch'));
    expect(store.getState().session.present.heat).toBeGreaterThan(heatBefore);
    act(() => {
      store.getState().undo();
    });
    expect(store.getState().session.present.heat).toBe(heatBefore);
  });

  it('skip card advances clue-giver without incrementing cards-cleared', () => {
    renderGetaway();
    expect(screen.getByTestId('clue-giver').textContent).toBe('Alice');
    fireEvent.click(screen.getByTestId('btn-skip-card'));
    expect(screen.getByTestId('clue-giver').textContent).toBe('Bob');
    expect(screen.getByTestId('cards-cleared').textContent).toContain('0');
  });

  it('skip card dispatches no engine event (heat unchanged)', () => {
    const store = renderGetaway();
    const heatBefore = store.getState().session.present.heat;
    fireEvent.click(screen.getByTestId('btn-skip-card'));
    expect(store.getState().session.present.heat).toBe(heatBefore);
  });

  it('buy seconds adds buySecondsBonus to the timer', () => {
    const store = renderGetaway();
    const heat = store.getState().session.present.heat;
    const brief = getawayBrief(heat, store.getState().cfg);
    const initialRemaining = brief.timerSeconds;

    fireEvent.click(screen.getByTestId('btn-buy-seconds'));

    const timerEl = screen.getByTestId('timer-display');
    const remaining = Number(timerEl.getAttribute('data-remaining'));
    expect(remaining).toBe(initialRemaining + obstacleOnlyCfg.getaway.buySecondsBonus);
  });

  it('clue-giver cycles back to first after last crew member', () => {
    renderGetaway(); // Alice (idx 0), Bob (idx 1)
    expect(screen.getByTestId('clue-giver').textContent).toBe('Alice'); // idx 0
    fireEvent.click(screen.getByTestId('btn-cleared')); // idx → 1 (Bob)
    expect(screen.getByTestId('clue-giver').textContent).toBe('Bob');
    fireEvent.click(screen.getByTestId('btn-skip-card')); // idx → 2 % 2 = 0 (Alice)
    expect(screen.getByTestId('clue-giver').textContent).toBe('Alice');
  });
});

// ── Timer control ──────────────────────────────────────────────────────────────

describe('Getaway timer control', () => {
  it('timer button initially shows Start', () => {
    renderGetaway();
    expect(screen.getByTestId('btn-toggle-timer').textContent).toBe('Start');
  });

  it('clicking start changes button to Pause', () => {
    renderGetaway();
    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    expect(screen.getByTestId('btn-toggle-timer').textContent).toBe('Pause');
  });

  it('timer does not count down when paused', () => {
    vi.useFakeTimers();
    const store = makeGetawayStoreWithCfg(shortTimerCfg);
    renderGetaway(store);
    const brief = getawayBrief(store.getState().session.present.heat, store.getState().cfg);
    const initial = brief.timerSeconds;

    // Do NOT start the timer — tick 2 seconds.
    tickSeconds(2);

    const remaining = Number(
      screen.getByTestId('timer-display').getAttribute('data-remaining'),
    );
    expect(remaining).toBe(initial);
  });

  it('timer counts down when running', () => {
    vi.useFakeTimers();
    const store = makeGetawayStoreWithCfg(shortTimerCfg);
    renderGetaway(store);
    const brief = getawayBrief(store.getState().session.present.heat, store.getState().cfg);

    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    tickSeconds(1);

    const remaining = Number(
      screen.getByTestId('timer-display').getAttribute('data-remaining'),
    );
    expect(remaining).toBe(brief.timerSeconds - 1);
  });
});

// ── Heat → brief mapping (acceptance: low Heat generous, high Heat brutal) ──────

describe('Getaway brief difficulty bands', () => {
  it('low Heat (0) yields generous brief: small target, long timer', () => {
    const store = makeGetawayStoreAtHeat(0);
    renderGetaway(store);

    const targetCards = Number(screen.getByTestId('target-cards').textContent);
    const timerRemaining = Number(
      screen.getByTestId('timer-display').getAttribute('data-remaining'),
    );

    // testCfg: lowHeat = { heat:0, targetCards:5, timerSeconds:90 }
    expect(targetCards).toBeLessThanOrEqual(6);
    expect(timerRemaining).toBeGreaterThanOrEqual(80);
  });

  it('high Heat (20) yields brutal brief: large target, short timer', () => {
    const store = makeGetawayStoreAtHeat(20);
    renderGetaway(store);

    const targetCards = Number(screen.getByTestId('target-cards').textContent);
    const timerRemaining = Number(
      screen.getByTestId('timer-display').getAttribute('data-remaining'),
    );

    // testCfg: highHeat = { heat:20, targetCards:12, timerSeconds:45 }
    expect(targetCards).toBeGreaterThanOrEqual(10);
    expect(timerRemaining).toBeLessThanOrEqual(55);
  });

  it('brief is locked at mount — GETAWAY_DITCH after mount does not change target/timer display', () => {
    renderGetaway(makeGetawayStore());

    const targetBefore = screen.getByTestId('target-cards').textContent;
    const timerBefore = screen.getByTestId('timer-display').getAttribute('data-remaining');

    // Ditch raises heat but brief should stay the same
    fireEvent.click(screen.getByTestId('btn-ditch'));

    expect(screen.getByTestId('target-cards').textContent).toBe(targetBefore);
    // Timer may change only if buy-seconds was clicked; ditch itself doesn't touch it
    expect(screen.getByTestId('timer-display').getAttribute('data-remaining')).toBe(timerBefore);
  });
});
