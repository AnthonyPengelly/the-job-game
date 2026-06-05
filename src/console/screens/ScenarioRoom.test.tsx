// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
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

/** Config variant that always generates scenario rooms (obstacleRatio=0.0). */
const scenarioOnlyCfg = {
  ...testCfg,
  generation: { obstacleRatio: 0.0 },
};

function makeScenarioStore(seed = 1) {
  const store = createGameStore({ cfg: scenarioOnlyCfg, storage: makeStorage() });
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

// ── ScenarioRoom tests ────────────────────────────────────────────────────────

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
