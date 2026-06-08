// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { EngineConfig } from '@/engine';
import type { StorageLike } from '@/platform';
import type { ParsedNarration } from '@/content/schema';
import { Spoils } from './Spoils';

afterEach(cleanup);

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

const obstacleOnlyCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'obs-safe',
        gameId: 'mock',
        lane: 'tech',
        options: [
          { id: 'opt-safe', greedy: false, heatCost: 1, reward: 1 },
          { id: 'opt-greedy', greedy: true, heatCost: 2, reward: 2 },
        ],
      },
    ],
  },
};

const obstacleWithGearCfg: EngineConfig = {
  ...obstacleOnlyCfg,
  gear: {
    'stat-tech-1': { id: 'stat-tech-1', kind: 'statBoost' as const, lane: 'tech' as const, magnitude: 1 },
    'powerup-tech': { id: 'powerup-tech', kind: 'powerUp' as const, lane: 'tech' as const },
  },
};

function makeNarrationFixture(): ParsedNarration {
  const variants = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, text: `${prefix} text ${i}` }));
  return {
    briefing: variants('br', 6),
    obstacleClue: variants('oc', 10),
    optionDescription: variants('od', 10),
    pushRun: variants('pr', 8),
    outcomeQuip: [
      { id: 'oq-clean-0', text: 'Clean quip A', when: { outcome: 'clean' } },
      { id: 'oq-clean-1', text: 'Clean quip B', when: { outcome: 'clean' } },
      { id: 'oq-complication-0', text: 'Complication quip A', when: { outcome: 'complication' } },
      { id: 'oq-complication-1', text: 'Complication quip B', when: { outcome: 'complication' } },
      { id: 'oq-botched-0', text: 'Botched quip A', when: { outcome: 'botched' } },
      { id: 'oq-botched-1', text: 'Botched quip B', when: { outcome: 'botched' } },
    ],
    scenarioSetup: variants('ss', 8),
    getawayIntro: variants('gi', 6),
    getawayCountdown: variants('gc', 6),
    winSting: variants('ws', 6),
    bustSting: variants('bs', 6),
  };
}

/** Build a store in the 'offer' phase after resolving a clean obstacle. */
function makeSpoilsStore(opts: { narration?: ParsedNarration; seed?: number } = {}) {
  const { narration, seed = 1 } = opts;
  const storage = makeStorage();
  const store = createGameStore({
    cfg: obstacleOnlyCfg,
    storage,
    ...(narration !== undefined ? { narration } : {}),
  });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room');
  }
  const alice = store.getState().session.present.crew[0]!;
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed: [alice.id],
  });
  // Dispatch RESOLVE_MINIGAME — store sets pendingSpoils=true + phase='offer'
  store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
  return store;
}

function renderSpoils(opts: { narration?: ParsedNarration; seed?: number } = {}) {
  const store = makeSpoilsStore(opts);
  const result = render(
    <StoreContext.Provider value={store}>
      <Spoils />
    </StoreContext.Provider>,
  );
  return { store, ...result };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('Spoils — rendering', () => {
  it('renders the spoils screen', () => {
    renderSpoils();
    expect(screen.getByTestId('screen-spoils')).toBeInTheDocument();
  });

  it('shows the loot-gained readout', () => {
    renderSpoils();
    expect(screen.getByTestId('spoils-loot')).toBeInTheDocument();
    expect(screen.getByTestId('spoils-loot-value')).toBeInTheDocument();
  });

  it('loot value matches the engine result for a clean safe obstacle', () => {
    renderSpoils();
    // Safe option reward = 1 (from obstacleOnlyCfg); clean outcome → reward = 1; formatLoot(1) = '$1'
    const val = screen.getByTestId('spoils-loot-value').textContent;
    expect(val).toBe('$1');
  });

  it('renders the Continue button', () => {
    renderSpoils();
    expect(screen.getByTestId('btn-spoils-continue')).toBeInTheDocument();
  });

  it('does not show gear section when earnedGear is empty', () => {
    renderSpoils();
    expect(screen.queryByTestId('spoils-gear-section')).toBeNull();
  });

  it('does not show resting section when no one is resting (2-player tired class)', () => {
    // 2-player crew → exhaustion class 'tired' (restRooms=0) → no one rests.
    renderSpoils();
    expect(screen.queryByTestId('spoils-resting')).toBeNull();
  });
});

// ── Resting crew ──────────────────────────────────────────────────────────────

/** Build a store with a 4-player crew (exhaustion='light', restRooms=1) so committed players rest. */
function makeSpoilsStoreWithResting() {
  const storage = makeStorage();
  const store = createGameStore({ cfg: obstacleOnlyCfg, storage });
  // 4 players → exhaustion class 'light', restRooms=1
  store.getState().startRun([
    { name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }, { name: 'Dave' },
  ], 1);
  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
  const alice = store.getState().session.present.crew[0]!;
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed: [alice.id],
  });
  store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
  return store;
}

describe('Spoils — resting crew', () => {
  it('shows committed crew member as resting (4-player light class, restRooms=1)', () => {
    const store = makeSpoilsStoreWithResting();
    const alice = store.getState().session.present.crew[0]!;
    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId(`spoils-resting-${alice.id}`)).toBeInTheDocument();
  });

  it('non-committed crew member is not shown as resting', () => {
    const store = makeSpoilsStoreWithResting();
    const bob = store.getState().session.present.crew[1]!;
    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );
    expect(screen.queryByTestId(`spoils-resting-${bob.id}`)).toBeNull();
  });
});

// ── CONTINUE ──────────────────────────────────────────────────────────────────

describe('Spoils — Continue', () => {
  it('Continue calls clearPendingSpoils, setting pendingSpoils to false', () => {
    const store = makeSpoilsStore();
    expect(store.getState().pendingSpoils).toBe(true);

    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('btn-spoils-continue'));
    expect(store.getState().pendingSpoils).toBe(false);
  });
});

// ── Gear assignment ────────────────────────────────────────────────────────────

/** Build a store with gear catalog + earnedGear for assignment tests. */
function makeGearSpoilsStore() {
  const storage = makeStorage();
  const store = createGameStore({ cfg: obstacleWithGearCfg, storage });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
  const alice = store.getState().session.present.crew[0]!;
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed: [alice.id],
  });
  store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
  // Inject earnedGear via setState (gear is normally added by scenario effects)
  store.setState(prev => ({
    session: {
      ...prev.session,
      present: {
        ...prev.session.present,
        earnedGear: ['stat-tech-1' as import('@/engine').GearId],
      },
    },
  }));
  return store;
}

describe('Spoils — gear assignment', () => {
  it('shows gear section when earnedGear is non-empty', () => {
    const store = makeGearSpoilsStore();
    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('spoils-gear-section')).toBeInTheDocument();
    expect(screen.getByTestId('spoils-gear-cards')).toBeInTheDocument();
  });

  it('renders a card for each earned gear item', () => {
    const store = makeGearSpoilsStore();
    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('spoils-gear-card-stat-tech-1')).toBeInTheDocument();
  });

  it('tap-card shows crew picker, tap crew dispatches ASSIGN_GEAR', () => {
    const store = makeGearSpoilsStore();
    const bob = store.getState().session.present.crew[1]!;

    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );

    // Tap card to select it
    fireEvent.click(screen.getByTestId('spoils-gear-card-stat-tech-1'));
    // Crew picker should appear
    expect(screen.getByTestId('spoils-crew-picker-stat-tech-1')).toBeInTheDocument();

    // Tap crew member to assign
    fireEvent.click(screen.getByTestId(`spoils-assign-stat-tech-1-${bob.id}`));

    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('ASSIGN_GEAR');
    if (lastEvent?.t === 'ASSIGN_GEAR') {
      expect(lastEvent.gear).toBe('stat-tech-1');
      expect(lastEvent.to).toBe(bob.id);
    }
  });

  it('tapping the same card again deselects it', () => {
    const store = makeGearSpoilsStore();
    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('spoils-gear-card-stat-tech-1'));
    expect(screen.getByTestId('spoils-crew-picker-stat-tech-1')).toBeInTheDocument();

    // Tap again to deselect
    fireEvent.click(screen.getByTestId('spoils-gear-card-stat-tech-1'));
    expect(screen.queryByTestId('spoils-crew-picker-stat-tech-1')).toBeNull();
  });
});

// ── Outcome quip narration ────────────────────────────────────────────────────

describe('Spoils — outcome quip narration', () => {
  it('shows outcome-quip teleprompter for obstacle rooms (clean)', () => {
    renderSpoils({ narration: makeNarrationFixture() });
    expect(screen.getByTestId('outcome-quip')).toBeInTheDocument();
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Clean quip');
  });

  it('does not show outcome-quip when no narration director', () => {
    renderSpoils();
    expect(screen.queryByTestId('outcome-quip')).toBeNull();
  });

  it('advance button re-picks a quip of the same outcome', () => {
    renderSpoils({ narration: makeNarrationFixture() });
    const advBtn = screen.getByTestId('teleprompter-advance');
    expect(advBtn).not.toBeDisabled();
    fireEvent.click(advBtn);
    const lineAfter = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(lineAfter).toContain('Clean quip');
  });
});

// ── Sell gear ─────────────────────────────────────────────────────────────────

describe('Spoils — sell gear button', () => {
  it('renders a sell button for each earned gear card', () => {
    const store = makeGearSpoilsStore();
    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('spoils-sell-stat-tech-1')).toBeInTheDocument();
  });

  it('sell button label contains formatted sell value via formatLoot', () => {
    const store = makeGearSpoilsStore();
    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );
    const sellBtn = screen.getByTestId('spoils-sell-stat-tech-1');
    // gearSellValue from testCfg: base=1000, perRoom=500; roomIndex=0 after start → $1k
    expect(sellBtn.textContent).toContain('$');
  });

  it('clicking sell button dispatches SELL_GEAR with correct index', () => {
    const store = makeGearSpoilsStore();
    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('spoils-sell-stat-tech-1'));

    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('SELL_GEAR');
    if (lastEvent?.t === 'SELL_GEAR') {
      expect(lastEvent.index).toBe(0);
    }
  });

  it('selling a gear card increases loot in the store', () => {
    const store = makeGearSpoilsStore();
    const lootBefore = store.getState().session.present.loot;
    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('spoils-sell-stat-tech-1'));
    expect(store.getState().session.present.loot).toBeGreaterThan(lootBefore);
  });

  it('gear can still be assigned through the existing flow after another card is sold', () => {
    // Add two gear items to earnedGear so we can sell one and assign the other
    const storage = makeStorage();
    const storeWith2Gear = createGameStore({ cfg: obstacleWithGearCfg, storage });
    storeWith2Gear.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    storeWith2Gear.setState(prev => ({
      session: {
        ...prev.session,
        present: {
          ...prev.session.present,
          earnedGear: [
            'stat-tech-1' as import('@/engine').GearId,
            'powerup-tech' as import('@/engine').GearId,
          ],
        },
      },
    }));

    render(
      <StoreContext.Provider value={storeWith2Gear}>
        <Spoils />
      </StoreContext.Provider>,
    );

    // Sell the first card (stat-tech-1)
    fireEvent.click(screen.getByTestId('spoils-sell-stat-tech-1'));

    // The remaining card (powerup-tech) should still be assignable
    expect(screen.getByTestId('spoils-gear-card-powerup-tech')).toBeInTheDocument();
    const bob = storeWith2Gear.getState().session.present.crew[1]!;
    fireEvent.click(screen.getByTestId('spoils-gear-card-powerup-tech'));
    fireEvent.click(screen.getByTestId(`spoils-assign-powerup-tech-${bob.id}`));

    const lastEvent = storeWith2Gear.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('ASSIGN_GEAR');
  });

  it('UNDO after selling restores the gear card', () => {
    const store = makeGearSpoilsStore();
    const lootBefore = store.getState().session.present.loot;
    const gearCountBefore = store.getState().session.present.earnedGear.length;

    render(
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('spoils-sell-stat-tech-1'));
    expect(store.getState().session.present.earnedGear.length).toBe(gearCountBefore - 1);

    store.getState().undo();
    expect(store.getState().session.present.earnedGear.length).toBe(gearCountBefore);
    expect(store.getState().session.present.loot).toBe(lootBefore);
  });
});

// ── pendingSpoils store wiring ─────────────────────────────────────────────────

describe('store — pendingSpoils transitions', () => {
  it('RESOLVE_MINIGAME sets pendingSpoils=true (minigame→offer)', () => {
    const store = makeSpoilsStore();
    expect(store.getState().pendingSpoils).toBe(true);
    expect(store.getState().session.present.phase).toBe('offer');
  });

  it('pendingSpoils is false initially (no run started)', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    expect(store.getState().pendingSpoils).toBe(false);
  });

  it('Undo from offer phase clears pendingSpoils', () => {
    const store = makeSpoilsStore();
    expect(store.getState().pendingSpoils).toBe(true);
    store.getState().undo();
    expect(store.getState().session.present.phase).toBe('minigame');
    expect(store.getState().pendingSpoils).toBe(false);
  });

  it('clearPendingSpoils sets pendingSpoils=false', () => {
    const store = makeSpoilsStore();
    expect(store.getState().pendingSpoils).toBe(true);
    store.getState().clearPendingSpoils();
    expect(store.getState().pendingSpoils).toBe(false);
  });
});
