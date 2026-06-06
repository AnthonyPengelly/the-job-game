// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { PlayerId, ScenarioChoiceDef } from '@/engine';
import type { ParsedNarration } from '@/content/schema';
import { SETTINGS_VERSION } from '@/content/schema/settings';
import { ScenarioRoom } from './ScenarioRoom';

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

function makeNarrationFixture(): ParsedNarration {
  const variants = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, text: `${prefix} text ${i}` }));
  return {
    briefing: variants('br', 8),
    obstacleClue: variants('oc', 10),
    optionDescription: variants('od', 10),
    pushRun: variants('pr', 8),
    outcomeQuip: variants('oq', 18),
    scenarioSetup: variants('ss', 8),
    getawayIntro: variants('gi', 6),
    getawayCountdown: variants('gc', 6),
    winSting: variants('ws', 6),
    bustSting: variants('bs', 6),
  };
}

/** Config variant that always generates scenario rooms (obstacleRatio=0.0). */
const scenarioOnlyCfg = {
  ...testCfg,
  generation: { obstacleRatio: 0.0 },
};

function makeScenarioStore(seed = 1) {
  const narration = makeNarrationFixture();
  const store = createGameStore({ cfg: scenarioOnlyCfg, storage: makeStorage(), narration });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);
  return store;
}

function renderScenarioRoom(seed = 1) {
  const store = makeScenarioStore(seed);
  const { container } = render(
    <StoreContext.Provider value={store}>
      <ScenarioRoom />
    </StoreContext.Provider>,
  );
  return { store, container };
}

// ── Roll-scenario test config ─────────────────────────────────────────────────

/**
 * Config with a single roll-choice scenario so the roll-path tests stay simple.
 * baseDifficulty=13, charm lane, Alice starts with charm=0 → DC = 13.
 */
const rollScenarioCfg = {
  ...testCfg,
  generation: { obstacleRatio: 0.0 },
  roomTemplates: {
    ...testCfg.roomTemplates,
    scenarios: [
      {
        id: 'scen-roll',
        setup: 'The guard turns around.',
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

function makeRollStore(seed = 42, diceModePhysical = false) {
  const storage = makeStorage();
  if (diceModePhysical) {
    storage.setItem(
      'the-job:settings',
      JSON.stringify({ version: SETTINGS_VERSION, diceMode: 'physical' }),
    );
  }
  const narration = makeNarrationFixture();
  const store = createGameStore({ cfg: rollScenarioCfg, storage, narration });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);
  return store;
}

/** Helper: dispatch CHOOSE_SCENARIO for the roll choice (Alice) to get to Stage 2. */
function advanceToRollReveal(store: ReturnType<typeof makeRollStore>) {
  const alice = store.getState().session.present.crew[0]!;
  act(() => {
    store.getState().dispatch({
      t: 'CHOOSE_SCENARIO',
      choiceId: 'sr-roll',
      attemptedBy: alice.id as PlayerId,
    });
  });
}

function renderRollRoom(seed = 42, diceModePhysical = false) {
  const store = makeRollStore(seed, diceModePhysical);
  const { container } = render(
    <StoreContext.Provider value={store}>
      <ScenarioRoom />
    </StoreContext.Provider>,
  );
  return { store, container };
}

// ── ScenarioRoom tests (no-roll path) ─────────────────────────────────────────

describe('ScenarioRoom screen', () => {
  it('renders with data-testid screen-room', () => {
    renderScenarioRoom();
    expect(screen.getByTestId('screen-room')).toBeInTheDocument();
  });

  it('stage one shows both choice label buttons', () => {
    const { store } = renderScenarioRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'scenario') throw new Error('Expected scenario room');

    expect(screen.getByTestId(`btn-choice-${room.choices[0].id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`btn-choice-${room.choices[1].id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`btn-choice-${room.choices[0].id}`)).toHaveTextContent(
      room.choices[0].label,
    );
    expect(screen.getByTestId(`btn-choice-${room.choices[1].id}`)).toHaveTextContent(
      room.choices[1].label,
    );
  });

  it('stage one does not leak heat or loot numbers pre-commit', () => {
    const { container } = renderScenarioRoom();

    // No heat/loot indicator elements rendered in the opaque stage
    expect(container.querySelector('[data-testid^="choice-heat-"]')).toBeNull();
    expect(container.querySelector('[data-testid^="choice-loot-"]')).toBeNull();
    // Stage-two confirmed-choice is not visible yet
    expect(screen.queryByTestId('confirmed-choice')).toBeNull();
    expect(screen.queryByTestId('btn-confirm')).toBeNull();
  });

  it('choosing a choice transitions to stage two and reveals the picked label', () => {
    const { store } = renderScenarioRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'scenario') throw new Error('Expected scenario room');
    const choice = room.choices[0];

    fireEvent.click(screen.getByTestId(`btn-choice-${choice.id}`));

    expect(screen.getByTestId('confirmed-choice')).toBeInTheDocument();
    expect(screen.getByTestId('confirmed-label')).toHaveTextContent(choice.label);
  });

  it('stage two shows a confirm button and no raw choice buttons', () => {
    const { store } = renderScenarioRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'scenario') throw new Error('Expected scenario room');

    fireEvent.click(screen.getByTestId(`btn-choice-${room.choices[0].id}`));

    expect(screen.getByTestId('btn-confirm')).toBeInTheDocument();
    // Original choice buttons are gone from stage two
    expect(screen.queryByTestId(`btn-choice-${room.choices[0].id}`)).toBeNull();
    expect(screen.queryByTestId(`btn-choice-${room.choices[1].id}`)).toBeNull();
  });

  it('confirming dispatches CHOOSE_SCENARIO and advances the engine to offer', () => {
    const { store } = renderScenarioRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'scenario') throw new Error('Expected scenario room');
    const choice = room.choices[0];

    fireEvent.click(screen.getByTestId(`btn-choice-${choice.id}`));
    fireEvent.click(screen.getByTestId('btn-confirm'));

    expect(store.getState().session.present.phase).toBe('offer');
  });

  it('confirming records the correct choiceId in the run history', () => {
    const { store } = renderScenarioRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'scenario') throw new Error('Expected scenario room');
    const choice = room.choices[1];

    fireEvent.click(screen.getByTestId(`btn-choice-${choice.id}`));
    fireEvent.click(screen.getByTestId('btn-confirm'));

    const state = store.getState().session.present;
    const lastResult = state.history[state.history.length - 1];
    expect(lastResult?.kind).toBe('scenario');
    if (lastResult?.kind === 'scenario') {
      expect(lastResult.choiceId).toBe(choice.id);
    }
  });

  it('confirming reflects the engine heat/loot change in the store', () => {
    const { store } = renderScenarioRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'scenario') throw new Error('Expected scenario room');

    const heatBefore = store.getState().session.present.heat;
    const lootBefore = store.getState().session.present.loot;
    const choice = room.choices[0];

    fireEvent.click(screen.getByTestId(`btn-choice-${choice.id}`));
    fireEvent.click(screen.getByTestId('btn-confirm'));

    const state = store.getState().session.present;
    const lastResult = state.history[state.history.length - 1];
    if (lastResult?.kind !== 'scenario') throw new Error('Expected scenario history entry');

    // Heat is clamped at 0 by applyScenarioSwing; loot delta applied directly.
    expect(state.heat).toBe(Math.max(0, heatBefore + lastResult.heatGained));
    expect(state.loot).toBe(lootBefore + lastResult.lootGained);
  });

  it('second choice also correctly dispatches CHOOSE_SCENARIO', () => {
    const { store } = renderScenarioRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'scenario') throw new Error('Expected scenario room');
    const choice = room.choices[1];

    fireEvent.click(screen.getByTestId(`btn-choice-${choice.id}`));
    fireEvent.click(screen.getByTestId('btn-confirm'));

    const state = store.getState().session.present;
    expect(state.phase).toBe('offer');
    const lastResult = state.history[state.history.length - 1];
    expect(lastResult?.kind).toBe('scenario');
    if (lastResult?.kind === 'scenario') {
      expect(lastResult.choiceId).toBe(choice.id);
    }
  });
});

// ── Narration tests ───────────────────────────────────────────────────────────

describe('ScenarioRoom narration', () => {
  it('stage one shows a scenarioSetup narration framing line via the teleprompter', () => {
    renderScenarioRoom();
    expect(screen.getByTestId('scenario-narration')).toBeInTheDocument();
    const line = screen.getByTestId('teleprompter-line');
    expect(line.textContent).not.toBe('');
  });

  it('teleprompter advance button is always enabled (no dead-end)', () => {
    renderScenarioRoom();
    const advanceBtn = screen.getByTestId('teleprompter-advance');
    expect(advanceBtn).not.toBeDisabled();
    fireEvent.click(advanceBtn);
    expect(screen.getByTestId('teleprompter-line')).toBeInTheDocument();
  });

  it('scenario authored body text (scenario-setup) still appears below the teleprompter', () => {
    renderRollRoom();
    expect(screen.getByTestId('scenario-setup')).toHaveTextContent('The guard turns around.');
  });

  it('choice buttons remain reachable regardless of narration state', () => {
    renderRollRoom();
    fireEvent.click(screen.getByTestId('teleprompter-advance'));
    expect(screen.getByTestId('btn-choice-sr-roll')).toBeInTheDocument();
    expect(screen.getByTestId('btn-choice-sr-effect')).toBeInTheDocument();
  });

  it('narration teleprompter is not shown in stage two (roll reveal)', () => {
    const { store } = renderRollRoom();
    advanceToRollReveal(store);
    // Stage 2 shows roll-reveal, not the narration teleprompter or choices.
    expect(screen.queryByTestId('scenario-narration')).toBeNull();
    expect(screen.getByTestId('roll-reveal')).toBeInTheDocument();
  });
});

// ── Stage one — opaque: no lane/DC/odds pre-commit ────────────────────────────

describe('ScenarioRoom stage one (opaque) — roll scenario', () => {
  it('shows setup text and both choice labels', () => {
    renderRollRoom();
    expect(screen.getByTestId('scenario-setup')).toHaveTextContent('The guard turns around.');
    expect(screen.getByTestId('btn-choice-sr-roll')).toHaveTextContent('Talk your way out');
    expect(screen.getByTestId('btn-choice-sr-effect')).toHaveTextContent('Hide quietly');
  });

  it('does not reveal lane, DC, or odds in stage one', () => {
    renderRollRoom();
    expect(screen.queryByTestId('roll-reveal')).toBeNull();
    expect(screen.queryByTestId('reveal-lane')).toBeNull();
    expect(screen.queryByTestId('reveal-dc')).toBeNull();
    expect(screen.queryByTestId('reveal-odds')).toBeNull();
  });
});

// ── Attempter picker (stage 1b) ───────────────────────────────────────────────

describe('ScenarioRoom attempter picker — roll choice', () => {
  it('clicking a roll choice shows the attempter picker', () => {
    renderRollRoom();
    fireEvent.click(screen.getByTestId('btn-choice-sr-roll'));
    expect(screen.getByTestId('attempter-select')).toBeInTheDocument();
  });

  it('attempter picker lists all crew members', () => {
    const { store } = renderRollRoom();
    fireEvent.click(screen.getByTestId('btn-choice-sr-roll'));
    const crew = store.getState().session.present.crew;
    crew.forEach(player => {
      expect(screen.getByTestId(`btn-attempter-${player.id}`)).toHaveTextContent(player.name);
    });
  });

  it('back button returns to stage one choices', () => {
    renderRollRoom();
    fireEvent.click(screen.getByTestId('btn-choice-sr-roll'));
    expect(screen.queryByTestId('scenario-choices')).toBeNull();
    fireEvent.click(screen.getByTestId('btn-back'));
    expect(screen.getByTestId('scenario-choices')).toBeInTheDocument();
  });

  it('selecting an attempter dispatches CHOOSE_SCENARIO and shows roll reveal', () => {
    const { store } = renderRollRoom();
    fireEvent.click(screen.getByTestId('btn-choice-sr-roll'));
    const alice = store.getState().session.present.crew[0]!;
    fireEvent.click(screen.getByTestId(`btn-attempter-${alice.id}`));
    // Engine should have set pendingRoll; roll-reveal appears
    expect(screen.getByTestId('roll-reveal')).toBeInTheDocument();
  });
});

// ── Stage two (transparent): DC and odds reveal ───────────────────────────────

describe('ScenarioRoom stage two — DC and odds reveal', () => {
  it('revealed DC equals clamp(baseDifficulty − laneRating, 1, 20)', () => {
    const { store } = renderRollRoom();
    advanceToRollReveal(store);

    // baseDifficulty=13, Alice charm=0 → DC = clamp(13−0, 1, 20) = 13
    expect(screen.getByTestId('reveal-dc')).toHaveTextContent('13');
  });

  it('revealed odds equal (21 − DC) / 20', () => {
    const { store } = renderRollRoom();
    advanceToRollReveal(store);

    // DC=13 → odds = (21−13)/20 = 8/20 = 0.4
    expect(screen.getByTestId('reveal-odds')).toHaveTextContent('0.4');
  });

  it('shows lane and rating in the reveal', () => {
    const { store } = renderRollRoom();
    advanceToRollReveal(store);

    expect(screen.getByTestId('reveal-lane')).toHaveTextContent('charm');
    // Alice has charm=0
    expect(screen.getByTestId('reveal-rating')).toHaveTextContent('0');
  });

  it('choice buttons are not shown in stage two', () => {
    const { store } = renderRollRoom();
    advanceToRollReveal(store);

    expect(screen.queryByTestId('btn-choice-sr-roll')).toBeNull();
    expect(screen.queryByTestId('btn-choice-sr-effect')).toBeNull();
  });

  it('DC with boosted stat: baseDifficulty=13, stat=3 → DC=10', () => {
    const store = makeRollStore(42);
    // Boost Alice's charm to 3
    const alice = store.getState().session.present.crew[0]!;
    store.getState().dispatch({ t: 'OVERRIDE_SET_STAT', player: alice.id, lane: 'charm', value: 3 });
    render(
      <StoreContext.Provider value={store}>
        <ScenarioRoom />
      </StoreContext.Provider>,
    );
    advanceToRollReveal(store);
    // DC = clamp(13-3, 1, 20) = 10
    expect(screen.getByTestId('reveal-dc')).toHaveTextContent('10');
    // odds = (21-10)/20 = 0.55
    expect(screen.getByTestId('reveal-odds')).toHaveTextContent('0.55');
  });
});

// ── App mode roll ─────────────────────────────────────────────────────────────

describe('ScenarioRoom app mode roll', () => {
  it('shows Roll button and no physical input in app mode', () => {
    const { store } = renderRollRoom(42, false);
    advanceToRollReveal(store);

    expect(screen.getByTestId('btn-roll')).toBeInTheDocument();
    expect(screen.queryByTestId('input-physical-roll')).toBeNull();
  });

  it('clicking Roll dispatches RESOLVE_SCENARIO_ROLL and advances to offer', () => {
    const { store } = renderRollRoom(42, false);
    advanceToRollReveal(store);

    fireEvent.click(screen.getByTestId('btn-roll'));

    expect(store.getState().session.present.phase).toBe('offer');
  });

  it('app mode roll resolves via seeded RNG and is reproducible (same seed → same result)', () => {
    // Two identical stores: same seed, same config, same events → same roll outcome.
    const store1 = makeRollStore(99, false);
    const store2 = makeRollStore(99, false);

    const alice1 = store1.getState().session.present.crew[0]!;
    const alice2 = store2.getState().session.present.crew[0]!;

    store1.getState().dispatch({
      t: 'CHOOSE_SCENARIO', choiceId: 'sr-roll', attemptedBy: alice1.id,
    });
    store2.getState().dispatch({
      t: 'CHOOSE_SCENARIO', choiceId: 'sr-roll', attemptedBy: alice2.id,
    });

    store1.getState().dispatch({ t: 'RESOLVE_SCENARIO_ROLL' });
    store2.getState().dispatch({ t: 'RESOLVE_SCENARIO_ROLL' });

    const hist1 = store1.getState().session.present.history.at(-1);
    const hist2 = store2.getState().session.present.history.at(-1);

    if (hist1?.kind !== 'scenario' || hist2?.kind !== 'scenario') {
      throw new Error('Expected scenario history entries');
    }

    expect(hist1.roll).toBe(hist2.roll);
    expect(hist1.success).toBe(hist2.success);
  });

  it('app mode records roll and dc in history', () => {
    const { store } = renderRollRoom(42, false);
    advanceToRollReveal(store);

    fireEvent.click(screen.getByTestId('btn-roll'));

    const hist = store.getState().session.present.history.at(-1);
    if (hist?.kind !== 'scenario') throw new Error('Expected scenario result');
    expect(typeof hist.roll).toBe('number');
    expect(hist.dc).toBe(13);
    expect(typeof hist.success).toBe('boolean');
  });
});

// ── Physical mode roll ────────────────────────────────────────────────────────

describe('ScenarioRoom physical mode roll', () => {
  it('shows physical input and no Roll button in physical mode', () => {
    const { store } = renderRollRoom(42, true);
    advanceToRollReveal(store);

    expect(screen.getByTestId('input-physical-roll')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-roll')).toBeNull();
  });

  it('submit button is disabled when input is empty', () => {
    const { store } = renderRollRoom(42, true);
    advanceToRollReveal(store);

    expect(screen.getByTestId('btn-submit-physical')).toBeDisabled();
  });

  it('submit button is disabled for out-of-range values (0 and 21)', () => {
    const { store } = renderRollRoom(42, true);
    advanceToRollReveal(store);

    fireEvent.change(screen.getByTestId('input-physical-roll'), { target: { value: '0' } });
    expect(screen.getByTestId('btn-submit-physical')).toBeDisabled();
    expect(screen.getByTestId('physical-roll-error')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-physical-roll'), { target: { value: '21' } });
    expect(screen.getByTestId('btn-submit-physical')).toBeDisabled();
  });

  it('submit button is enabled for valid values 1–20', () => {
    const { store } = renderRollRoom(42, true);
    advanceToRollReveal(store);

    fireEvent.change(screen.getByTestId('input-physical-roll'), { target: { value: '15' } });
    expect(screen.getByTestId('btn-submit-physical')).not.toBeDisabled();
    expect(screen.queryByTestId('physical-roll-error')).toBeNull();
  });

  it('submitting a valid physical roll advances phase to offer', () => {
    const { store } = renderRollRoom(42, true);
    advanceToRollReveal(store);

    fireEvent.change(screen.getByTestId('input-physical-roll'), { target: { value: '15' } });
    fireEvent.click(screen.getByTestId('btn-submit-physical'));

    expect(store.getState().session.present.phase).toBe('offer');
  });

  it('physical roll uses the entered value as externalRoll in history', () => {
    const { store } = renderRollRoom(42, true);
    advanceToRollReveal(store);

    fireEvent.change(screen.getByTestId('input-physical-roll'), { target: { value: '20' } });
    fireEvent.click(screen.getByTestId('btn-submit-physical'));

    const hist = store.getState().session.present.history.at(-1);
    if (hist?.kind !== 'scenario') throw new Error('Expected scenario result');
    expect(hist.roll).toBe(20);
    expect(hist.success).toBe(true); // 20 ≥ DC(13) → success
  });

  it('physical roll 1 fails (1 < DC=13)', () => {
    const { store } = renderRollRoom(42, true);
    advanceToRollReveal(store);

    fireEvent.change(screen.getByTestId('input-physical-roll'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('btn-submit-physical'));

    const hist = store.getState().session.present.history.at(-1);
    if (hist?.kind !== 'scenario') throw new Error('Expected scenario result');
    expect(hist.roll).toBe(1);
    expect(hist.success).toBe(false); // 1 < DC(13) and critFumble=false → fail
  });

  it('the physical roll is UNDO_LAST-able: after submit + undo, state reverts with pendingRoll', () => {
    const { store } = renderRollRoom(42, true);
    advanceToRollReveal(store);

    fireEvent.change(screen.getByTestId('input-physical-roll'), { target: { value: '15' } });
    fireEvent.click(screen.getByTestId('btn-submit-physical'));

    expect(store.getState().session.present.phase).toBe('offer');

    act(() => { store.getState().undo(); });

    // After undo the offer-phase change is reversed; pendingRoll is restored.
    expect(store.getState().session.present.phase).not.toBe('offer');
    const room = store.getState().session.present.currentRoom;
    expect(room?.kind).toBe('scenario');
    if (room?.kind === 'scenario') {
      expect(room.pendingRoll).toBeDefined();
      expect(room.pendingRoll?.dc).toBe(13);
    }
  });
});

// ── Dice mode switching ───────────────────────────────────────────────────────

describe('ScenarioRoom dice mode switching', () => {
  it('switching from app to physical shows physical input and hides Roll button', () => {
    const { store } = renderRollRoom(42, false);
    advanceToRollReveal(store);

    // App mode: Roll button visible
    expect(screen.getByTestId('btn-roll')).toBeInTheDocument();

    // Switch to physical
    act(() => { store.getState().setDiceMode('physical'); });

    // Physical mode: Roll button gone, physical input visible
    expect(screen.queryByTestId('btn-roll')).toBeNull();
    expect(screen.getByTestId('input-physical-roll')).toBeInTheDocument();
  });

  it('switching from physical to app shows Roll button and hides physical input', () => {
    const { store } = renderRollRoom(42, true);
    advanceToRollReveal(store);

    // Physical mode: input visible
    expect(screen.getByTestId('input-physical-roll')).toBeInTheDocument();

    // Switch to app
    act(() => { store.getState().setDiceMode('app'); });

    // App mode: Roll button visible, input gone
    expect(screen.getByTestId('btn-roll')).toBeInTheDocument();
    expect(screen.queryByTestId('input-physical-roll')).toBeNull();
  });
});

// ── No-roll choice resolves directly ─────────────────────────────────────────

describe('ScenarioRoom no-roll choice resolves directly', () => {
  it('clicking the no-roll choice shows confirmation (no attempter picker, no roll reveal)', () => {
    renderRollRoom();
    fireEvent.click(screen.getByTestId('btn-choice-sr-effect'));

    expect(screen.getByTestId('confirmed-label')).toHaveTextContent('Hide quietly');
    expect(screen.getByTestId('btn-confirm')).toBeInTheDocument();
    expect(screen.queryByTestId('attempter-select')).toBeNull();
    expect(screen.queryByTestId('roll-reveal')).toBeNull();
  });

  it('confirming a no-roll choice dispatches CHOOSE_SCENARIO and advances to offer', () => {
    const { store } = renderRollRoom();
    fireEvent.click(screen.getByTestId('btn-choice-sr-effect'));
    fireEvent.click(screen.getByTestId('btn-confirm'));

    expect(store.getState().session.present.phase).toBe('offer');
    const hist = store.getState().session.present.history.at(-1);
    if (hist?.kind !== 'scenario') throw new Error('Expected scenario result');
    expect(hist.choiceId).toBe('sr-effect');
    expect(hist.roll).toBeUndefined();
  });
});
