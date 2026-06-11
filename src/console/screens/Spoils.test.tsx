// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { EngineConfig, PlayerId, ScenarioChoiceDef } from '@/engine';
import type { StorageLike } from '@/platform';
import type { ParsedNarration } from '@/content/schema';
import { ActionBarSlotProvider, ActionBarSlotOutlet } from '@/console/shell/actionBarSlot';
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
    roomApproach: variants('ra', 4),
    scenarioReveal: variants('sr', 4),
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
    <ActionBarSlotProvider>
      <ActionBarSlotOutlet />
      <StoreContext.Provider value={store}>
        <Spoils />
      </StoreContext.Provider>
    </ActionBarSlotProvider>,
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

  it('loot banked value shows + prefix for clean safe obstacle (reward=1)', () => {
    renderSpoils();
    // Safe option reward = 1 (from obstacleOnlyCfg); clean outcome → reward = 1; formatLoot(1) = '$1'
    const val = screen.getByTestId('spoils-loot-value').textContent;
    expect(val).toBe('+$1');
  });

  it('shows the run total in spoils-loot-total', () => {
    renderSpoils();
    expect(screen.getByTestId('spoils-loot-total')).toBeInTheDocument();
    const total = screen.getByTestId('spoils-loot-total').textContent ?? '';
    expect(total).toContain('$');
  });

  it('shows the room heat delta and the new heat total', () => {
    const { store } = renderSpoils();
    const present = store.getState().session.present;
    const lastResult = present.history.at(-1);
    expect(lastResult).toBeDefined();
    const expectedDelta = lastResult!.heatGained;
    const value = screen.getByTestId('spoils-heat-value').textContent ?? '';
    expect(value).toBe(expectedDelta > 0 ? `+${expectedDelta}` : String(expectedDelta));
    const total = screen.getByTestId('spoils-heat-total').textContent ?? '';
    expect(total).toContain(`Now at ${present.heat}`);
  });

  it('renders the Continue button (in action bar)', () => {
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

// ── Outcome banner ────────────────────────────────────────────────────────────

describe('Spoils — outcome banner', () => {
  it('shows the outcome banner for obstacle rooms', () => {
    renderSpoils();
    expect(screen.getByTestId('spoils-outcome-banner')).toBeInTheDocument();
  });

  it('shows "Clean" for a clean obstacle outcome', () => {
    renderSpoils();
    const val = screen.getByTestId('spoils-outcome-value').textContent;
    expect(val).toBe('Clean');
  });

  it('shows "Complication" for a complication obstacle outcome', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: obstacleOnlyCfg, storage });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle');
    const alice = store.getState().session.present.crew[0]!;
    store.getState().dispatch({ t: 'CHOOSE_OPTION', optionId: room.options[0]!.id, committed: [alice.id] });
    store.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'complication' });

    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    const val = screen.getByTestId('spoils-outcome-value').textContent;
    expect(val).toBe('Complication');
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
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId(`spoils-resting-${alice.id}`)).toBeInTheDocument();
  });

  it('non-committed crew member is not shown as resting', () => {
    const store = makeSpoilsStoreWithResting();
    const bob = store.getState().session.present.crew[1]!;
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
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
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
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
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('spoils-gear-section')).toBeInTheDocument();
    expect(screen.getByTestId('spoils-gear-cards')).toBeInTheDocument();
  });

  it('renders a card for each earned gear item', () => {
    const store = makeGearSpoilsStore();
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('spoils-gear-card-stat-tech-1')).toBeInTheDocument();
  });

  it('selecting a crew member from the assign dropdown dispatches ASSIGN_GEAR', () => {
    const store = makeGearSpoilsStore();
    const bob = store.getState().session.present.crew[1]!;

    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );

    const select = screen.getByTestId('spoils-assign-stat-tech-1');
    fireEvent.change(select, { target: { value: bob.id } });

    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('ASSIGN_GEAR');
    if (lastEvent?.t === 'ASSIGN_GEAR') {
      expect(lastEvent.gear).toBe('stat-tech-1');
      expect(lastEvent.to).toBe(bob.id);
    }
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

  it('advance button absent at last committed line (no re-roll)', () => {
    // script() commits a single outcomeQuip line — hasNext=false → no advance button.
    renderSpoils({ narration: makeNarrationFixture() });
    expect(screen.queryByTestId('teleprompter-advance')).toBeNull();
    // The committed line is still shown.
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Clean quip');
  });
});

// ── Sell gear ─────────────────────────────────────────────────────────────────

describe('Spoils — sell gear button', () => {
  it('renders a sell button for each earned gear card', () => {
    const store = makeGearSpoilsStore();
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('spoils-sell-stat-tech-1')).toBeInTheDocument();
  });

  it('sell button label contains formatted sell value via formatLoot', () => {
    const store = makeGearSpoilsStore();
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    const sellBtn = screen.getByTestId('spoils-sell-stat-tech-1');
    // gearSellValue from testCfg: base=1000, perRoom=500; roomIndex=0 after start → $1k
    expect(sellBtn.textContent).toContain('$');
  });

  it('clicking sell button dispatches SELL_GEAR with correct index', () => {
    const store = makeGearSpoilsStore();
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
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
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    fireEvent.click(screen.getByTestId('spoils-sell-stat-tech-1'));
    expect(store.getState().session.present.loot).toBeGreaterThan(lootBefore);
  });

  it('gear can still be assigned after another card is sold', () => {
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
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={storeWith2Gear}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );

    // Sell the first card (stat-tech-1)
    fireEvent.click(screen.getByTestId('spoils-sell-stat-tech-1'));

    // The remaining card (powerup-tech) should still be assignable
    expect(screen.getByTestId('spoils-gear-card-powerup-tech')).toBeInTheDocument();
    const bob = storeWith2Gear.getState().session.present.crew[1]!;
    const select = screen.getByTestId('spoils-assign-powerup-tech');
    fireEvent.change(select, { target: { value: bob.id } });

    const lastEvent = storeWith2Gear.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('ASSIGN_GEAR');
  });

  it('UNDO after selling restores the gear card', () => {
    const store = makeGearSpoilsStore();
    const lootBefore = store.getState().session.present.loot;
    const gearCountBefore = store.getState().session.present.earnedGear.length;

    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
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

// ── Scenario reveal narration ──────────────────────────────────────────────────

/**
 * Config that always generates scenario rooms with a single roll-choice scenario.
 * baseDifficulty=13 and Alice starts charm=0 → DC=13.
 * externalRoll=20 → success; externalRoll=1 → failure.
 */
const scenarioRevealCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 0.0 },
  roomTemplates: {
    ...testCfg.roomTemplates,
    scenarios: [
      {
        id: 'scen-reveal',
        setup: 'The guard turns.',
        choices: [
          {
            id: 'sr-roll',
            label: 'Talk your way out',
            roll: {
              lane: 'charm' as const,
              baseDifficulty: 13,
              success: { heatDelta: -1, lootDelta: 1 },
              failure: { heatDelta: 2, lootDelta: 0 },
            },
          },
          {
            id: 'sr-effect',
            label: 'Hide quietly',
            effect: { heatDelta: 0, lootDelta: 0 },
          },
        ] as [ScenarioChoiceDef, ScenarioChoiceDef],
      },
    ],
  },
};

function makeScenarioNarrationFixture(): ParsedNarration {
  const variants = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, text: `${prefix} text ${i}` }));
  return {
    ...makeNarrationFixture(),
    scenarioReveal: [
      { id: 'sr-clean-0', text: 'Scenario clean reveal', when: { outcome: 'clean' } },
      { id: 'sr-complication-0', text: 'Scenario complication reveal', when: { outcome: 'complication' } },
      ...variants('sr-unfiltered', 2),
    ],
  };
}

/**
 * Build a store in the 'offer' phase after resolving a scenario roll.
 * externalRoll=20 → success=true; externalRoll=1 → success=false.
 */
function makeScenarioSpoilsStore(opts: { externalRoll: number; narration?: ParsedNarration }) {
  const { externalRoll, narration } = opts;
  const storage = makeStorage();
  const store = createGameStore({
    cfg: scenarioRevealCfg,
    storage,
    ...(narration !== undefined ? { narration } : {}),
  });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'scenario') {
    throw new Error('Expected scenario room');
  }
  const alice = store.getState().session.present.crew[0]!;
  store.getState().dispatch({
    t: 'CHOOSE_SCENARIO',
    choiceId: 'sr-roll',
    attemptedBy: alice.id as PlayerId,
  });
  store.getState().dispatch({ t: 'RESOLVE_SCENARIO_ROLL', externalRoll });
  store.getState().dispatch({ t: 'ACK_SCENARIO_ROLL' });
  return store;
}

describe('Spoils — scenario reveal narration', () => {
  it('shows scenarioReveal teleprompter for scenario rooms', () => {
    const store = makeScenarioSpoilsStore({
      externalRoll: 20,
      narration: makeScenarioNarrationFixture(),
    });
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    expect(screen.getByTestId('outcome-quip')).toBeInTheDocument();
  });

  it('success=true maps to clean outcome → shows clean scenarioReveal line', () => {
    const store = makeScenarioSpoilsStore({
      externalRoll: 20,
      narration: makeScenarioNarrationFixture(),
    });
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Scenario clean reveal');
  });

  it('success=false maps to complication outcome → shows complication scenarioReveal line', () => {
    const store = makeScenarioSpoilsStore({
      externalRoll: 1,
      narration: makeScenarioNarrationFixture(),
    });
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <Spoils />
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    const line = screen.getByTestId('teleprompter-line').textContent ?? '';
    expect(line).toContain('Scenario complication reveal');
  });
});
