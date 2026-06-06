// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { ParsedNarration } from '@/content/schema';
import { ObstacleRoom } from './ObstacleRoom';
import { MinigameStub } from './MinigameStub';

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

/** Config variant that always generates obstacle rooms (obstacleRatio=1.0). */
const obstacleOnlyCfg = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
};

/** Start a run with two players using the obstacle-only config. Seed 1 is stable. */
function makeObstacleStore(seed = 1) {
  const narration = makeNarrationFixture();
  const store = createGameStore({ cfg: obstacleOnlyCfg, storage: makeStorage(), narration });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);
  return store;
}

function renderObstacleRoom(seed = 1) {
  const store = makeObstacleStore(seed);
  render(
    <StoreContext.Provider value={store}>
      <ObstacleRoom />
    </StoreContext.Provider>,
  );
  return store;
}

/** Start a run with three players — for 3 players crewPerOption[1]=2, so maxCrew=2 < crew.length. */
function makeObstacleStore3(seed = 1) {
  const narration = makeNarrationFixture();
  const store = createGameStore({ cfg: obstacleOnlyCfg, storage: makeStorage(), narration });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }], seed);
  return store;
}

function renderMinigameStub(seed = 1) {
  const store = makeObstacleStore(seed);
  // Advance to minigame phase via CHOOSE_OPTION.
  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected an obstacle room after startRun with obstacleOnlyCfg');
  }
  const crew = store.getState().session.present.crew;
  // Use the safe option (options[0]).
  const safeOption = room.options[0]!;
  const committedPlayer = crew[0]!;
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: safeOption.id,
    committed: [committedPlayer.id],
  });

  render(
    <StoreContext.Provider value={store}>
      <MinigameStub />
    </StoreContext.Provider>,
  );
  return store;
}

// ── ObstacleRoom tests ────────────────────────────────────────────────────────

describe('ObstacleRoom screen', () => {
  it('renders with data-testid screen-room', () => {
    renderObstacleRoom();
    expect(screen.getByTestId('screen-room')).toBeInTheDocument();
  });

  it('shows the obstacle lane clue from the template config', () => {
    renderObstacleRoom();
    // The lane text is always present; just verify the element exists.
    expect(screen.getByTestId('obstacle-lane')).toBeInTheDocument();
  });

  it('renders both option cards with reward and heat', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    for (const option of room.options) {
      expect(screen.getByTestId(`option-card-${option.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`option-reward-${option.id}`)).toHaveTextContent(
        String(option.reward),
      );
      expect(screen.getByTestId(`option-heat-${option.id}`)).toHaveTextContent(
        String(option.heatCost),
      );
      expect(screen.getByTestId(`option-game-${option.id}`)).toBeInTheDocument();
    }
  });

  it('commit button is disabled before any option is selected', () => {
    renderObstacleRoom();
    expect(screen.getByTestId('btn-commit')).toBeDisabled();
  });

  it('shows crew checkboxes after an option is selected', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));
    expect(screen.getByTestId('crew-commit')).toBeInTheDocument();
  });

  it('commit button disabled when crew below commitRange minimum', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    // Select an option — minimum is 1 crew.
    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    // Commit without selecting any crew — 0 selected, min is 1.
    expect(screen.getByTestId('btn-commit')).toBeDisabled();
  });

  it('commit button enabled when exactly the minimum crew are selected', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    // Select exactly 1 crew member (minimum is 1 for 2-player game in testCfg).
    fireEvent.click(screen.getByTestId(`crew-checkbox-${crew[0]!.id}`));
    expect(screen.getByTestId('btn-commit')).not.toBeDisabled();
  });

  it('cannot check more crew than the commitRange maximum', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    // The max commit for 2 players with testCfg profile '2' is 2.
    // Select both crew members.
    fireEvent.click(screen.getByTestId(`crew-checkbox-${crew[0]!.id}`));
    fireEvent.click(screen.getByTestId(`crew-checkbox-${crew[1]!.id}`));

    // After selecting the maximum, extra checkboxes are disabled.
    // (No third player exists in this test, so instead verify both are checked
    // and the button is enabled — enforcing the max IS the test for 2 players.)
    expect(screen.getByTestId(`crew-checkbox-${crew[0]!.id}`)).toBeChecked();
    expect(screen.getByTestId(`crew-checkbox-${crew[1]!.id}`)).toBeChecked();
    expect(screen.getByTestId('btn-commit')).not.toBeDisabled();
  });

  it('disables surplus checkbox once commitRange max is reached (3-player, max=2)', () => {
    // 3 players with profile '3': crewPerOption=[1,2] → maxCrew = min(2, 3) = 2 < crew.length=3
    const store = makeObstacleStore3();
    render(
      <StoreContext.Provider value={store}>
        <ObstacleRoom />
      </StoreContext.Provider>,
    );
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    // Check the first two crew members (reaches the max of 2).
    fireEvent.click(screen.getByTestId(`crew-checkbox-${crew[0]!.id}`));
    fireEvent.click(screen.getByTestId(`crew-checkbox-${crew[1]!.id}`));

    // Third player's checkbox must be disabled — max already reached.
    expect(screen.getByTestId(`crew-checkbox-${crew[2]!.id}`)).toBeDisabled();
    // First two remain checked and commit is valid.
    expect(screen.getByTestId(`crew-checkbox-${crew[0]!.id}`)).toBeChecked();
    expect(screen.getByTestId(`crew-checkbox-${crew[1]!.id}`)).toBeChecked();
    expect(screen.getByTestId('btn-commit')).not.toBeDisabled();
  });

  it('dispatches CHOOSE_OPTION with the chosen option id and crew', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;
    const safeOption = room.options[0]!;

    // Select option and one crew member, then commit.
    fireEvent.click(screen.getByTestId(`option-select-${safeOption.id}`));
    fireEvent.click(screen.getByTestId(`crew-checkbox-${crew[0]!.id}`));
    fireEvent.click(screen.getByTestId('btn-commit'));

    // Engine should now be in minigame phase.
    expect(store.getState().session.present.phase).toBe('minigame');
    // currentRoom should record the committed option.
    const updatedRoom = store.getState().session.present.currentRoom;
    if (updatedRoom === null || updatedRoom.kind !== 'obstacle') {
      throw new Error('Expected obstacle room after CHOOSE_OPTION');
    }
    expect(updatedRoom.committedOptionId).toBe(safeOption.id);
    expect(updatedRoom.committedBy).toContain(crew[0]!.id);
  });
});

// ── Narration tests ───────────────────────────────────────────────────────────

describe('ObstacleRoom narration', () => {
  it('renders the teleprompter with the obstacle clue line', () => {
    renderObstacleRoom();
    expect(screen.getByTestId('teleprompter')).toBeInTheDocument();
    const line = screen.getByTestId('teleprompter-line');
    expect(line.textContent).not.toBe('');
  });

  it('teleprompter advance button is always enabled (no dead-end)', () => {
    renderObstacleRoom();
    const advanceBtn = screen.getByTestId('teleprompter-advance');
    expect(advanceBtn).not.toBeDisabled();
    fireEvent.click(advanceBtn);
    // After advance the teleprompter line element still exists.
    expect(screen.getByTestId('teleprompter-line')).toBeInTheDocument();
  });

  it('renders narration lines on each option card', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    for (const option of room.options) {
      expect(screen.getByTestId(`option-narration-${option.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`option-narration-${option.id}`).textContent).not.toBe('');
    }
  });

  it('commit button remains reachable regardless of narration state', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;

    // Advance narration and verify commit still works.
    fireEvent.click(screen.getByTestId('teleprompter-advance'));
    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));
    fireEvent.click(screen.getByTestId(`crew-checkbox-${crew[0]!.id}`));
    expect(screen.getByTestId('btn-commit')).not.toBeDisabled();
  });
});

// ── MinigameStub tests ────────────────────────────────────────────────────────

describe('MinigameStub screen', () => {
  it('renders with data-testid screen-minigame', () => {
    renderMinigameStub();
    expect(screen.getByTestId('screen-minigame')).toBeInTheDocument();
  });

  it('shows all three outcome buttons', () => {
    renderMinigameStub();
    expect(screen.getByTestId('btn-outcome-clean')).toBeInTheDocument();
    expect(screen.getByTestId('btn-outcome-complication')).toBeInTheDocument();
    expect(screen.getByTestId('btn-outcome-botched')).toBeInTheDocument();
  });

  it('clean outcome advances to offer phase and adds loot equal to option reward', () => {
    const store = renderMinigameStub();
    const lootBefore = store.getState().session.present.loot;

    fireEvent.click(screen.getByTestId('btn-outcome-clean'));

    const state = store.getState().session.present;
    expect(state.phase).toBe('offer');
    // clean → loot += option.reward (1 for the safe option)
    expect(state.loot).toBeGreaterThan(lootBefore);
    // history records the obstacle result
    const lastResult = state.history[state.history.length - 1];
    expect(lastResult?.kind).toBe('obstacle');
    if (lastResult?.kind === 'obstacle') {
      expect(lastResult.outcome).toBe('clean');
    }
  });

  it('complication outcome advances to offer phase and reflects heat and loot change', () => {
    const store = renderMinigameStub();
    const heatBefore = store.getState().session.present.heat;

    fireEvent.click(screen.getByTestId('btn-outcome-complication'));

    const state = store.getState().session.present;
    expect(state.phase).toBe('offer');
    // complication adds more heat than clean
    expect(state.heat).toBeGreaterThan(heatBefore);
    const lastResult = state.history[state.history.length - 1];
    expect(lastResult?.kind).toBe('obstacle');
    if (lastResult?.kind === 'obstacle') {
      expect(lastResult.outcome).toBe('complication');
    }
  });

  it('botched outcome advances to offer phase and reflects heat change', () => {
    const store = renderMinigameStub();
    const heatBefore = store.getState().session.present.heat;

    fireEvent.click(screen.getByTestId('btn-outcome-botched'));

    const state = store.getState().session.present;
    expect(state.phase).toBe('offer');
    // botched: outcomeLoot.botched=0 loot gained; heat increases
    expect(state.heat).toBeGreaterThan(heatBefore);
    const lastResult = state.history[state.history.length - 1];
    expect(lastResult?.kind).toBe('obstacle');
    if (lastResult?.kind === 'obstacle') {
      expect(lastResult.outcome).toBe('botched');
    }
  });

  it('exact heat and loot values match engine arithmetic for clean outcome', () => {
    // drip at room 0 = obstacleHeat.safe + Math.floor(0 * rampPerObstacle) = 1 + 0 = 1
    // outcomeHeat.clean = 0 → total heat = 1
    // loot = option.reward = 1 (safe option)
    const store = renderMinigameStub();

    fireEvent.click(screen.getByTestId('btn-outcome-clean'));

    const state = store.getState().session.present;
    expect(state.heat).toBe(1);
    expect(state.loot).toBe(1);
  });

  it('exact heat and loot values match engine arithmetic for complication outcome', () => {
    // drip=1, outcomeHeat.complication=1 → heat=2; outcomeLoot.complication=1 → loot=1
    const store = renderMinigameStub();

    fireEvent.click(screen.getByTestId('btn-outcome-complication'));

    const state = store.getState().session.present;
    expect(state.heat).toBe(2);
    expect(state.loot).toBe(1);
  });

  it('exact heat and loot values match engine arithmetic for botched outcome', () => {
    // drip=1, outcomeHeat.botched=2 → heat=3; outcomeLoot.botched=0 → loot=0
    const store = renderMinigameStub();

    fireEvent.click(screen.getByTestId('btn-outcome-botched'));

    const state = store.getState().session.present;
    expect(state.heat).toBe(3);
    expect(state.loot).toBe(0);
  });
});
