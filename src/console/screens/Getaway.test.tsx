// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import { getawayBrief } from '@/engine';
import type { StorageLike } from '@/platform';
import type { AudioEngine } from '@/platform';
import type { PlayerViewSlice } from '@/platform/channel';
import type { ParsedNarration } from '@/content/schema';
import * as channelModule from '@/platform/channel';
import { ActionBarSlotProvider, ActionBarSlotOutlet } from '@/console/shell/actionBarSlot';
import { AudioHandleContext } from '@/console/audio';
import type { AudioHandle } from '@/console/audio';
import soundJson from '../../../presets/default/content/sound.json';
import { soundManifestSchema } from '@/content/schema';
import { Getaway } from './Getaway';

const manifest = soundManifestSchema.parse(soundJson);

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

/**
 * Advance store to getaway and grant `skips` power-ups to the first crew member.
 * Used for tests that exercise the skip-card mechanic.
 */
function makeGetawayStoreWithSkips(skips: number) {
  const store = makeGetawayStore();
  const crew = store.getState().session.present.crew;
  const lanes = ['tech', 'physical', 'charm', 'stealth'] as const;
  for (let i = 0; i < skips && i < lanes.length; i++) {
    store.getState().dispatch({
      t: 'OVERRIDE_SET_POWERUP',
      player: crew[0]!.id,
      lane: lanes[i]!,
      held: true,
    });
  }
  return store;
}

function renderGetaway(store = makeGetawayStore()) {
  render(
    <ActionBarSlotProvider>
      <ActionBarSlotOutlet />
      <StoreContext.Provider value={store}>
        <Getaway />
      </StoreContext.Provider>
    </ActionBarSlotProvider>,
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

  it('shows Reading clues column with "Round the table" text', () => {
    renderGetaway();
    expect(screen.getByTestId('clue-giver').textContent).toBe('Round the table');
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
    expect(screen.getByTestId('btn-force-win')).toBeInTheDocument();
    expect(screen.getByTestId('btn-force-bust')).toBeInTheDocument();
  });

  it('renders the round bar with four columns: target/cleared/skips-left/clue-giver', () => {
    renderGetaway();
    expect(screen.getByTestId('getaway-roundbar')).toBeInTheDocument();
    expect(screen.getByTestId('target-cards')).toBeInTheDocument();
    expect(screen.getByTestId('cards-cleared')).toBeInTheDocument();
    expect(screen.getByTestId('skips-left')).toBeInTheDocument();
    expect(screen.getByTestId('clue-giver')).toBeInTheDocument();
  });
});

// ── ARMED / ACTIVE / near-bust states ─────────────────────────────────────────

describe('Getaway ARMED/ACTIVE states', () => {
  it('clock has ready class before START (ARMED)', () => {
    renderGetaway();
    const clock = screen.getByTestId('timer-display');
    expect(clock.className).toContain('ready');
    expect(clock.className).not.toContain('calm');
    expect(clock.className).not.toContain('danger');
  });

  it('clock does not tick before START', () => {
    vi.useFakeTimers();
    const store = makeGetawayStoreWithCfg(shortTimerCfg);
    renderGetaway(store);
    const initial = Number(screen.getByTestId('timer-display').getAttribute('data-remaining'));

    tickSeconds(2);

    const after = Number(screen.getByTestId('timer-display').getAttribute('data-remaining'));
    expect(after).toBe(initial);
  });

  it('clock has calm class after START when time is plentiful', () => {
    renderGetaway();
    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    const clock = screen.getByTestId('timer-display');
    expect(clock.className).toContain('calm');
    expect(clock.className).not.toContain('ready');
    expect(clock.className).not.toContain('danger');
  });

  it('clock-sub shows "Clock ready" in ARMED state', () => {
    renderGetaway();
    const sub = screen.getByTestId('clock-sub');
    expect(sub.textContent).toContain('ready');
  });

  it('clock-sub shows "Ticking" in ACTIVE state', () => {
    renderGetaway();
    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    const sub = screen.getByTestId('clock-sub');
    expect(sub.textContent).toContain('Ticking');
  });
});

// ── Near-bust (danger) state ────────────────────────────────────────────────────

describe('Getaway near-bust', () => {
  it('clock has danger class when active and ≤15 seconds remain', () => {
    vi.useFakeTimers();
    const store = makeGetawayStoreWithCfg(shortTimerCfg);
    renderGetaway(store);

    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    // shortTimerCfg has timerSeconds:3 at low heat, tick to 1 second left
    tickSeconds(2);

    const clock = screen.getByTestId('timer-display');
    expect(clock.className).toContain('danger');
    expect(clock.className).not.toContain('calm');
  });

  it('clock-sub has danger class when near-bust', () => {
    vi.useFakeTimers();
    const store = makeGetawayStoreWithCfg(shortTimerCfg);
    renderGetaway(store);

    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    tickSeconds(2);

    const sub = screen.getByTestId('clock-sub');
    expect(sub.className).toContain('danger');
  });

  it('clock does not have danger class when timer is not active even if time is low', () => {
    vi.useFakeTimers();
    const store = makeGetawayStoreWithCfg(shortTimerCfg);
    renderGetaway(store);

    // Start and then pause before it expires
    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    tickSeconds(2);
    // Pause at 1 second
    fireEvent.click(screen.getByTestId('btn-toggle-timer'));

    const clock = screen.getByTestId('timer-display');
    // After pause, timerActive=false → ready class, not danger
    expect(clock.className).toContain('ready');
    expect(clock.className).not.toContain('danger');
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

  it('cleared advances clue-giver (reflected in next published slice)', () => {
    const publishedSlices: PlayerViewSlice[] = [];
    vi.spyOn(channelModule, 'publishSlice').mockImplementation((s: PlayerViewSlice) => {
      publishedSlices.push(s);
    });
    const store = renderGetaway();
    publishedSlices.length = 0;
    fireEvent.click(screen.getByTestId('btn-cleared'));
    const last = publishedSlices.filter(s => s.kind === 'getaway').at(-1);
    expect(last?.kind === 'getaway' && last.clueGiverIndex).toBe(1 % store.getState().session.present.crew.length);
    vi.restoreAllMocks();
  });

  it('ditch dispatches GETAWAY_DITCH (drops Loot)', () => {
    const store = renderGetaway();
    const lootBefore = store.getState().session.present.loot;
    const heatBefore = store.getState().session.present.heat;
    fireEvent.click(screen.getByTestId('btn-ditch'));
    const lootAfter = store.getState().session.present.loot;
    const heatAfter = store.getState().session.present.heat;
    expect(lootAfter).toBe(Math.max(0, lootBefore - obstacleOnlyCfg.getaway.ditchLootCost));
    expect(heatAfter).toBe(heatBefore);
  });

  it('ditch advances clue-giver without incrementing cards-cleared', () => {
    const publishedSlices: PlayerViewSlice[] = [];
    vi.spyOn(channelModule, 'publishSlice').mockImplementation((s: PlayerViewSlice) => {
      publishedSlices.push(s);
    });
    renderGetaway();
    const beforeText = screen.getByTestId('cards-cleared').textContent ?? '';
    expect(beforeText).toContain('0');
    publishedSlices.length = 0;
    fireEvent.click(screen.getByTestId('btn-ditch'));
    expect(screen.getByTestId('cards-cleared').textContent).toContain('0');
    const last = publishedSlices.filter(s => s.kind === 'getaway').at(-1);
    expect(last?.kind === 'getaway' && last.clueGiverIndex).toBe(1);
    vi.restoreAllMocks();
  });

  it('ditch is undoable via store undo', () => {
    const store = renderGetaway();
    const lootBefore = store.getState().session.present.loot;
    fireEvent.click(screen.getByTestId('btn-ditch'));
    expect(store.getState().session.present.loot).toBeLessThanOrEqual(lootBefore);
    act(() => {
      store.getState().undo();
    });
    expect(store.getState().session.present.loot).toBe(lootBefore);
  });

  it('skip card (with power-up) advances clue-giver without incrementing cards-cleared', () => {
    const publishedSlices: PlayerViewSlice[] = [];
    vi.spyOn(channelModule, 'publishSlice').mockImplementation((s: PlayerViewSlice) => {
      publishedSlices.push(s);
    });
    const store = makeGetawayStoreWithSkips(1);
    renderGetaway(store);
    publishedSlices.length = 0;
    fireEvent.click(screen.getByTestId('btn-skip-card'));
    expect(screen.getByTestId('cards-cleared').textContent).toContain('0');
    const last = publishedSlices.filter(s => s.kind === 'getaway').at(-1);
    expect(last?.kind === 'getaway' && last.clueGiverIndex).toBe(1);
    vi.restoreAllMocks();
  });

  it('skip card dispatches no engine event (heat unchanged)', () => {
    const store = makeGetawayStoreWithSkips(1);
    renderGetaway(store);
    const heatBefore = store.getState().session.present.heat;
    fireEvent.click(screen.getByTestId('btn-skip-card'));
    expect(store.getState().session.present.heat).toBe(heatBefore);
  });

  it('clue-giver cycles back to first after last crew member (via published slice)', () => {
    const publishedSlices: PlayerViewSlice[] = [];
    vi.spyOn(channelModule, 'publishSlice').mockImplementation((s: PlayerViewSlice) => {
      publishedSlices.push(s);
    });
    const store = makeGetawayStoreWithSkips(1);
    renderGetaway(store); // Alice (idx 0), Bob (idx 1)
    publishedSlices.length = 0;
    fireEvent.click(screen.getByTestId('btn-cleared')); // idx → 1
    fireEvent.click(screen.getByTestId('btn-skip-card')); // idx → 2 % 2 = 0
    const last = publishedSlices.filter(s => s.kind === 'getaway').at(-1);
    expect(last?.kind === 'getaway' && last.clueGiverIndex).toBe(0);
    vi.restoreAllMocks();
  });
});

// ── Power-up skips ─────────────────────────────────────────────────────────────

describe('Getaway power-up skips', () => {
  it('skips-left column shows 0 when crew has no power-ups', () => {
    renderGetaway();
    const el = screen.getByTestId('skips-left');
    expect(el.textContent).toContain('0');
  });

  it('skips-left column shows count from crew power-ups', () => {
    const store = makeGetawayStoreWithSkips(2);
    renderGetaway(store);
    const el = screen.getByTestId('skips-left');
    expect(el.textContent).toContain('2');
  });

  it('skip button is disabled when no power-ups remain', () => {
    renderGetaway();
    const btn = screen.getByTestId('btn-skip-card');
    expect(btn).toBeDisabled();
  });

  it('skip button is enabled when crew holds at least one power-up', () => {
    const store = makeGetawayStoreWithSkips(1);
    renderGetaway(store);
    expect(screen.getByTestId('btn-skip-card')).not.toBeDisabled();
  });

  it('skip decrements skips-left and the button disables at zero', () => {
    const store = makeGetawayStoreWithSkips(1);
    renderGetaway(store);
    expect(screen.getByTestId('skips-left').textContent).toContain('1');
    fireEvent.click(screen.getByTestId('btn-skip-card'));
    expect(screen.getByTestId('skips-left').textContent).toContain('0');
    expect(screen.getByTestId('btn-skip-card')).toBeDisabled();
  });

  it('Cleared, Ditch and Force controls remain enabled when skip is exhausted (no dead-end)', () => {
    renderGetaway(); // 0 power-ups → skip already disabled
    expect(screen.getByTestId('btn-skip-card')).toBeDisabled();
    expect(screen.getByTestId('btn-cleared')).not.toBeDisabled();
    expect(screen.getByTestId('btn-ditch')).not.toBeDisabled();
    expect(screen.getByTestId('btn-force-win')).not.toBeDisabled();
    expect(screen.getByTestId('btn-force-bust')).not.toBeDisabled();
  });

  it('skip sub-label reads "N left · 1 per power-up"', () => {
    const store = makeGetawayStoreWithSkips(3);
    renderGetaway(store);
    const btn = screen.getByTestId('btn-skip-card');
    expect(btn.textContent).toContain('3 left');
    expect(btn.textContent).toContain('1 per power-up');
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

    // Ditch drops Loot but the brief should stay the same
    fireEvent.click(screen.getByTestId('btn-ditch'));

    expect(screen.getByTestId('target-cards').textContent).toBe(targetBefore);
    // Ditch doesn't touch the timer
    expect(screen.getByTestId('timer-display').getAttribute('data-remaining')).toBe(timerBefore);
  });
});

// ── Player-view slice publish / teardown ───────────────────────────────────────

describe('Getaway player-view publish', () => {
  let publishedSlices: PlayerViewSlice[];

  beforeEach(() => {
    publishedSlices = [];
    vi.spyOn(channelModule, 'publishSlice').mockImplementation((slice: PlayerViewSlice) => {
      publishedSlices.push(slice);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('publishes a getaway slice on mount', () => {
    renderGetaway();
    const getawayCalls = publishedSlices.filter(s => s.kind === 'getaway');
    expect(getawayCalls.length).toBeGreaterThan(0);
  });

  it('published slice contains player-safe fields only', () => {
    renderGetaway();
    const slice = publishedSlices.find(s => s.kind === 'getaway');
    expect(slice).toBeDefined();
    if (slice?.kind !== 'getaway') return;
    expect(slice).toHaveProperty('cardsCleared');
    expect(slice).toHaveProperty('targetCards');
    expect(slice).toHaveProperty('secondsRemaining');
    expect(slice).toHaveProperty('clueGiverName');
    expect(slice).toHaveProperty('clueGiverIndex');
    expect(slice).toHaveProperty('gameActive');
    // Must NOT contain GM-only fields
    expect(slice).not.toHaveProperty('heat');
    expect(slice).not.toHaveProperty('getawayOdds');
  });

  it('publishes updated slice after Cleared action', () => {
    renderGetaway();
    publishedSlices.length = 0;

    fireEvent.click(screen.getByTestId('btn-cleared'));

    const getawayCalls = publishedSlices.filter(s => s.kind === 'getaway');
    expect(getawayCalls.length).toBeGreaterThan(0);
    const last = getawayCalls.at(-1);
    if (last?.kind !== 'getaway') return;
    expect(last.cardsCleared).toBe(1);
  });

  it('publishes idle slice on unmount (resolve or navigate away)', () => {
    const { unmount } = render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={makeGetawayStore()}>
          <Getaway />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );

    publishedSlices.length = 0;
    act(() => { unmount(); });

    expect(publishedSlices.some(s => s.kind === 'idle')).toBe(true);
  });

  it('publishes idle slice after force-win resolution (component unmounts on phase change)', () => {
    renderGetaway();
    publishedSlices.length = 0;

    act(() => {
      fireEvent.click(screen.getByTestId('btn-force-win'));
    });
    cleanup();

    expect(publishedSlices.some(s => s.kind === 'idle')).toBe(true);
  });
});

// ── Narration: getawayIntro and getawayCountdown ───────────────────────────────

function makeGetawayNarrationFixture(): ParsedNarration {
  const variants = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, text: `${prefix} text ${i}` }));
  return {
    briefing: variants('br', 6),
    obstacleClue: variants('oc', 10),
    optionDescription: variants('od', 10),
    pushRun: variants('pr', 8),
    outcomeQuip: variants('oq', 18),
    scenarioSetup: variants('ss', 8),
    getawayIntro: [
      { id: 'gi-0', text: 'Getaway intro line A' },
      { id: 'gi-1', text: 'Getaway intro line B' },
      { id: 'gi-2', text: 'Getaway intro line C' },
      { id: 'gi-3', text: 'Getaway intro line D' },
    ],
    getawayCountdown: [
      { id: 'gc-0', text: 'Getaway countdown line A' },
      { id: 'gc-1', text: 'Getaway countdown line B' },
      { id: 'gc-2', text: 'Getaway countdown line C' },
      { id: 'gc-3', text: 'Getaway countdown line D' },
    ],
    winSting: variants('ws', 6),
    bustSting: variants('bs', 6),
    roomApproach: variants('ra', 4),
    scenarioApproach: variants('sap', 4),
    scenarioReveal: variants('sr', 4),
  };
}

function makeGetawayStoreWithNarration(seed = 1) {
  const narration = makeGetawayNarrationFixture();
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

  if (store.getState().session.present.phase !== 'getaway') throw new Error('Expected getaway phase');
  return store;
}

describe('Getaway screen — narration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(channelModule, 'publishSlice').mockImplementation(() => {});
  });

  it('renders getaway-intro-narration container with teleprompter when narration is loaded', () => {
    const store = makeGetawayStoreWithNarration();
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Getaway />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('getaway-intro-narration')).toBeInTheDocument();
    const line = screen.getAllByTestId('teleprompter-line')[0]?.textContent ?? '';
    expect(line).toContain('Getaway intro line');
  });

  it('renders getaway-countdown-narration container with teleprompter when narration is loaded', () => {
    const store = makeGetawayStoreWithNarration();
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Getaway />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('getaway-countdown-narration')).toBeInTheDocument();
  });

  it('both narration teleprompters show committed lines (no advance at last line)', () => {
    // script() commits a single line per beat — hasNext=false → no advance buttons.
    const store = makeGetawayStoreWithNarration();
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Getaway />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    // No advance buttons — each teleprompter is already at its last (only) line.
    expect(screen.queryByTestId('teleprompter-advance')).toBeNull();
    // Both narration containers still render with their committed lines.
    expect(screen.getByTestId('getaway-intro-narration')).toBeInTheDocument();
    expect(screen.getByTestId('getaway-countdown-narration')).toBeInTheDocument();
    // All game controls remain present.
    expect(screen.getByTestId('btn-cleared')).toBeInTheDocument();
    expect(screen.getByTestId('btn-force-win')).toBeInTheDocument();
  });

  it('narration absent when no director is loaded (backward compat)', () => {
    // Store WITHOUT narration — introLine/countdownLine will be '' so containers are not rendered
    const store = makeGetawayStore();
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Getaway />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.queryByTestId('getaway-intro-narration')).toBeNull();
    expect(screen.queryByTestId('getaway-countdown-narration')).toBeNull();
  });
});

// ── Audio: Getaway audio cues ─────────────────────────────────────────────────

function makeMockEngine(): AudioEngine {
  return {
    preload: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(),
    stop: vi.fn(),
    setChannelGain: vi.fn(),
    setMasterGain: vi.fn(),
    mute: vi.fn(),
    setAmbient: vi.fn(),
    scheduleBeep: vi.fn(),
    isCuePlaying: vi.fn().mockReturnValue(false),
    stopLoopsForPhase: vi.fn(),
    isCueAvailable: vi.fn().mockReturnValue(true),
    clock: {
      now: vi.fn().mockReturnValue(0),
      scheduleAt: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    },
    get loaded() { return false; },
  };
}

function renderGetawayWithAudio(store = makeGetawayStore(), engine = makeMockEngine()) {
  const handle: AudioHandle = { engine, manifest };
  render(
    <ActionBarSlotProvider>
      <ActionBarSlotOutlet />
      <AudioHandleContext.Provider value={handle}>
        <StoreContext.Provider value={store}>
          <Getaway />
        </StoreContext.Provider>
      </AudioHandleContext.Provider>
    </ActionBarSlotProvider>,
  );
  return { store, engine };
}

describe('Getaway audio — start cue', () => {
  beforeEach(() => {
    vi.spyOn(channelModule, 'publishSlice').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays finale-engine when START is pressed', () => {
    const { engine } = renderGetawayWithAudio();
    const play = engine.play as ReturnType<typeof vi.fn>;
    play.mockClear();
    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    expect(play).toHaveBeenCalledWith('finale-engine');
  });

  it('plays sfx-tick when START is pressed', () => {
    const { engine } = renderGetawayWithAudio();
    const play = engine.play as ReturnType<typeof vi.fn>;
    play.mockClear();
    fireEvent.click(screen.getByTestId('btn-toggle-timer'));
    expect(play).toHaveBeenCalledWith('sfx-tick');
  });

  it('does not play start cues before START is pressed', () => {
    const { engine } = renderGetawayWithAudio();
    const play = engine.play as ReturnType<typeof vi.fn>;
    play.mockClear();
    // No action — timer not yet started
    expect(play).not.toHaveBeenCalledWith('finale-engine');
    expect(play).not.toHaveBeenCalledWith('sfx-tick');
  });
});

describe('Getaway audio — ticking control', () => {
  beforeEach(() => {
    vi.spyOn(channelModule, 'publishSlice').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stops sfx-tick when timer is paused', () => {
    const { engine } = renderGetawayWithAudio();
    fireEvent.click(screen.getByTestId('btn-toggle-timer')); // start
    (engine.stop as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByTestId('btn-toggle-timer')); // pause
    expect(engine.stop).toHaveBeenCalledWith('sfx-tick');
  });

  it('stops finale-engine when timer is paused', () => {
    const { engine } = renderGetawayWithAudio();
    fireEvent.click(screen.getByTestId('btn-toggle-timer')); // start
    (engine.stop as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByTestId('btn-toggle-timer')); // pause
    expect(engine.stop).toHaveBeenCalledWith('finale-engine');
  });

  it('resets heistSfx channel gain to 1.0 when timer pauses', () => {
    const { engine } = renderGetawayWithAudio();
    fireEvent.click(screen.getByTestId('btn-toggle-timer')); // start
    (engine.setChannelGain as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByTestId('btn-toggle-timer')); // pause
    expect(engine.setChannelGain).toHaveBeenCalledWith('heistSfx', 1.0);
  });

  it('raises heistSfx channel gain at near-bust (≤15 s)', () => {
    vi.useFakeTimers();
    const store = makeGetawayStoreWithCfg(shortTimerCfg); // timerSeconds=3
    const { engine } = renderGetawayWithAudio(store);

    fireEvent.click(screen.getByTestId('btn-toggle-timer')); // start
    (engine.setChannelGain as ReturnType<typeof vi.fn>).mockClear();

    // With shortTimerCfg (3 s), all seconds qualify as ≤15 — intensity is already raised.
    // Tick 1 second to confirm the channel gain is above 1.0.
    act(() => { vi.advanceTimersByTime(1000); });

    const calls = (engine.setChannelGain as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: unknown[]) => c[0] === 'heistSfx');
    expect(calls.some((c: unknown[]) => (c[1] as number) > 1.0)).toBe(true);
    vi.useRealTimers();
  });
});

describe('Getaway audio — win sting', () => {
  beforeEach(() => {
    vi.spyOn(channelModule, 'publishSlice').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays sting-win when cards are cleared to target', () => {
    const store = makeGetawayStore();
    const brief = getawayBrief(
      store.getState().session.present.heat,
      store.getState().cfg,
    );
    const { engine } = renderGetawayWithAudio(store);
    (engine.play as ReturnType<typeof vi.fn>).mockClear();
    for (let i = 0; i < brief.targetCards; i++) {
      fireEvent.click(screen.getByTestId('btn-cleared'));
    }
    expect(engine.play).toHaveBeenCalledWith('sting-win');
    expect(engine.play).not.toHaveBeenCalledWith('sting-bust');
  });

  it('plays sting-win on Force win', () => {
    const { engine } = renderGetawayWithAudio();
    (engine.play as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByTestId('btn-force-win'));
    expect(engine.play).toHaveBeenCalledWith('sting-win');
    expect(engine.play).not.toHaveBeenCalledWith('sting-bust');
  });

  it('stops looping cues before playing sting-win', () => {
    const { engine } = renderGetawayWithAudio();
    fireEvent.click(screen.getByTestId('btn-toggle-timer')); // start tick/engine
    const callOrder: string[] = [];
    (engine.stop as ReturnType<typeof vi.fn>).mockImplementation((id: string) => callOrder.push(`stop:${id}`));
    (engine.play as ReturnType<typeof vi.fn>).mockImplementation((id: string) => callOrder.push(`play:${id}`));
    fireEvent.click(screen.getByTestId('btn-force-win'));
    const stingIdx = callOrder.indexOf('play:sting-win');
    const stopTickIdx = callOrder.indexOf('stop:sfx-tick');
    expect(stingIdx).toBeGreaterThan(-1);
    expect(stopTickIdx).toBeGreaterThan(-1);
    expect(stopTickIdx).toBeLessThan(stingIdx);
  });
});

describe('Getaway audio — bust sting', () => {
  beforeEach(() => {
    vi.spyOn(channelModule, 'publishSlice').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays sting-bust on Force bust', () => {
    const { engine } = renderGetawayWithAudio();
    (engine.play as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByTestId('btn-force-bust'));
    expect(engine.play).toHaveBeenCalledWith('sting-bust');
    expect(engine.play).not.toHaveBeenCalledWith('sting-win');
  });

  it('plays sting-bust on timer expiry', () => {
    vi.useFakeTimers();
    const store = makeGetawayStoreWithCfg(shortTimerCfg);
    const brief = getawayBrief(
      store.getState().session.present.heat,
      store.getState().cfg,
    );
    const { engine } = renderGetawayWithAudio(store);

    fireEvent.click(screen.getByTestId('btn-toggle-timer')); // start
    (engine.play as ReturnType<typeof vi.fn>).mockClear();

    tickSeconds(brief.timerSeconds + 1);

    expect(engine.play).toHaveBeenCalledWith('sting-bust');
    expect(engine.play).not.toHaveBeenCalledWith('sting-win');
    vi.useRealTimers();
  });

  it('does not fire sting twice on double resolve attempt', () => {
    const { engine } = renderGetawayWithAudio();
    (engine.play as ReturnType<typeof vi.fn>).mockClear();
    // Two rapid force-bust clicks — second must be no-op (resolvedRef guard)
    fireEvent.click(screen.getByTestId('btn-force-bust'));
    fireEvent.click(screen.getByTestId('btn-force-bust'));
    const bustCalls = (engine.play as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: unknown[]) => c[0] === 'sting-bust');
    expect(bustCalls.length).toBe(1);
  });
});

describe('Getaway audio — headless (no AudioProvider)', () => {
  beforeEach(() => {
    vi.spyOn(channelModule, 'publishSlice').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without throwing when no AudioProvider is present', () => {
    expect(() => renderGetaway()).not.toThrow();
  });

  it('START, resolve, and force actions do not throw without AudioProvider', () => {
    expect(() => {
      renderGetaway();
      fireEvent.click(screen.getByTestId('btn-toggle-timer'));
      fireEvent.click(screen.getByTestId('btn-force-win'));
    }).not.toThrow();
  });
});
