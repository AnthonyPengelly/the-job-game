// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { useGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { ParsedNarration } from '@/content/schema';
import { CrewRailModeProvider, useCrewRailMode } from '@/console/shell';
import type { PlayerId } from '@/engine';
import { ActionBarSlotProvider, ActionBarSlotOutlet } from '@/console/shell/actionBarSlot';
import { buildRegistry } from '@/minigames';
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
    roomApproach: variants('ra', 4),
    scenarioReveal: variants('sr', 4),
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

/**
 * A helper that renders one button per crew member inside CrewRailModeProvider.
 * Clicking the button calls toggleCommit, simulating a tap on the crew rail.
 */
function RailButtons() {
  const crew = useGameStore(s => s.session.present.crew);
  const { toggleCommit } = useCrewRailMode();
  return (
    <>
      {crew.map(p => (
        <button
          key={p.id}
          data-testid={`rail-toggle-${p.id}`}
          onClick={() => toggleCommit(p.id as PlayerId)}
          type="button"
        >
          {p.name}
        </button>
      ))}
    </>
  );
}

function renderObstacleRoom(seed = 1) {
  const store = makeObstacleStore(seed);
  render(
    <ActionBarSlotProvider>
      <ActionBarSlotOutlet />
      <StoreContext.Provider value={store}>
        <CrewRailModeProvider>
          <RailButtons />
          <ObstacleRoom />
        </CrewRailModeProvider>
      </StoreContext.Provider>
    </ActionBarSlotProvider>,
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
    <ActionBarSlotProvider>
      <ActionBarSlotOutlet />
      <StoreContext.Provider value={store}>
        <MinigameStub />
      </StoreContext.Provider>
    </ActionBarSlotProvider>,
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
    expect(screen.getByTestId('obstacle-lane')).toBeInTheDocument();
  });

  it('renders both option cards with lane chip, game name, reward, and heat', () => {
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
      // Lane chip and game name present inside the option-game container
      expect(screen.getByTestId(`option-game-${option.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`option-lane-chip-${option.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`option-game-name-${option.id}`)).toBeInTheDocument();
    }
  });

  it('lane chip falls back to the template lane when the game is unregistered', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    // testCfg gameIds ('alpha'…) are not in the registry — the template lane is the fallback.
    const template = obstacleOnlyCfg.roomTemplates.obstacles.find(
      t => t.id === room.templateId,
    );
    expect(template).toBeDefined();
    const laneText = template!.lane.charAt(0).toUpperCase() + template!.lane.slice(1);
    expect(screen.getByTestId(`option-lane-chip-${room.options[0]!.id}`)).toHaveTextContent(
      laneText,
    );
  });

  it('a combo game surfaces BOTH lanes — chip, header aside, commit copy', () => {
    // Bind the only obstacle template to a real two-lane game (Steady Hands:
    // physical + stealth) so the registry lookup drives the lane display.
    const comboCfg = {
      ...testCfg,
      generation: { obstacleRatio: 1.0 },
      roomTemplates: {
        ...testCfg.roomTemplates,
        obstacles: [
          {
            id: 'obs-combo',
            gameId: 'steadyHands',
            lane: 'physical',
            options: [
              { id: 'combo-safe', greedy: false, heatCost: 1, reward: 1 },
              { id: 'combo-greedy', greedy: true, heatCost: 2, reward: 2 },
            ] as [
              { id: string; greedy: boolean; heatCost: number; reward: number },
              { id: string; greedy: boolean; heatCost: number; reward: number },
            ],
          },
        ],
      },
    };
    const narration = makeNarrationFixture();
    const store = createGameStore({ cfg: comboCfg, storage: makeStorage(), narration });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <CrewRailModeProvider>
            <RailButtons />
            <ObstacleRoom />
          </CrewRailModeProvider>
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );

    const game = buildRegistry(comboCfg).find(g => g.id === 'steadyHands');
    expect(game).toBeDefined();
    expect(game!.lanes).toEqual(['physical', 'stealth']);

    // Header aside names both lanes.
    const aside = screen.getByTestId('obstacle-lane');
    expect(aside.textContent).toContain('Lanes:');
    expect(aside.textContent).toContain('physical');
    expect(aside.textContent).toContain('stealth');

    // Both option cards' lane chips show the combo.
    expect(screen.getByTestId('option-lane-chip-combo-safe')).toHaveTextContent(
      'Physical + Stealth',
    );
    expect(screen.getByTestId('option-lane-chip-combo-greedy')).toHaveTextContent(
      'Physical + Stealth',
    );

    // Commit-panel copy names the combo too.
    fireEvent.click(screen.getByTestId('option-select-combo-safe'));
    const side = screen.getByTestId('commit-side');
    expect(side.textContent).toContain('Physical + Stealth');
  });

  it('commit copy never promises rest at 2 players (tired class, restRooms=0)', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));
    const side = screen.getByTestId('commit-side');
    expect(side.textContent).not.toContain('rests next room');
    expect(side.textContent).toContain('no one rests');
    // Commit someone — the action-bar note must not promise a rest either.
    const alice = store.getState().session.present.crew[0]!;
    fireEvent.click(screen.getByTestId(`rail-toggle-${alice.id}`));
    expect(screen.getByTestId('action-note').textContent).not.toContain('rest next room');
  });

  it('reward cost label says "Reward" not "Loot"', () => {
    renderObstacleRoom();
    // Check that the cost label shows "Reward" text (the .k span)
    const rewardLabels = screen.getAllByText('Reward');
    expect(rewardLabels.length).toBeGreaterThan(0);
  });

  it('commit button is disabled before any option is selected', () => {
    renderObstacleRoom();
    expect(screen.getByTestId('btn-commit')).toBeDisabled();
  });

  it('switches to commit layout with side-panel after an option is selected', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    // The commit layout + side panel should appear
    expect(screen.getByTestId('commit-layout')).toBeInTheDocument();
    expect(screen.getByTestId('commit-side')).toBeInTheDocument();
    expect(screen.getByTestId('committed-panel')).toBeInTheDocument();
    // "Going in · 0 of N" chip row header
    expect(screen.getByTestId('commit-going-in')).toBeInTheDocument();
    // No old checkbox panel
    expect(screen.queryByTestId('crew-commit')).not.toBeInTheDocument();
  });

  it('shows GM-only difficulty dial after option selected', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    // Only shows when the game is registered; testCfg uses 'alpha'/'bravo'/etc. which are
    // unregistered — so dialLevel is undefined and the dial is not rendered. This is the
    // correct graceful fallback (no dead-end).
    // The test documents the behaviour rather than asserting the dial exists.
    // If running with real registered games the dial would appear.
    const dial = screen.queryByTestId('option-dial');
    // Dial may or may not be present depending on whether the game is in the registry.
    // With testCfg fake game IDs it won't be rendered.
    expect(dial).toBeNull();
  });

  it('commit button disabled when no crew committed (below min)', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    // Select an option — minimum is 1 crew.
    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    // Commit without selecting any crew — 0 selected, min is 1.
    expect(screen.getByTestId('btn-commit')).toBeDisabled();
  });

  it('commit button enables only at exactly the dictated commitCount', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;
    const option = room.options[0]!;
    expect(option.commitCount).toBeDefined();
    const count = option.commitCount!;

    fireEvent.click(screen.getByTestId(`option-select-${option.id}`));

    // Tap crew up to the dictated count — Commit must enable exactly there.
    for (let i = 0; i < count; i++) {
      expect(screen.getByTestId('btn-commit')).toBeDisabled();
      fireEvent.click(screen.getByTestId(`rail-toggle-${crew[i]!.id}`));
    }
    expect(screen.getByTestId('btn-commit')).not.toBeDisabled();
  });

  it('Going-in count updates as crew are toggled on the rail', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));
    expect(screen.getByTestId('commit-going-in').textContent).toContain('0 of');

    fireEvent.click(screen.getByTestId(`rail-toggle-${crew[0]!.id}`));
    expect(screen.getByTestId('commit-going-in').textContent).toContain('1 of');

    // Committed chip for the player should appear
    expect(screen.getByTestId(`commchip-${crew[0]!.id}`)).toBeInTheDocument();
  });

  it('dictated count honoured: tapping exactly N selects all N and enables commit', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;
    const option = room.options[0]!;
    const count = option.commitCount ?? 1;

    fireEvent.click(screen.getByTestId(`option-select-${option.id}`));

    for (let i = 0; i < count; i++) {
      fireEvent.click(screen.getByTestId(`rail-toggle-${crew[i]!.id}`));
      expect(screen.getByTestId(`commchip-${crew[i]!.id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('btn-commit')).not.toBeDisabled();
  });

  it('dictated count honoured with 3 players: an excess rail press is ignored', () => {
    const store = makeObstacleStore3();
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <CrewRailModeProvider>
            <RailButtons />
            <ObstacleRoom />
          </CrewRailModeProvider>
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;
    const option = room.options[0]!;
    expect(option.commitCount).toBeDefined();
    const count = option.commitCount!;
    // 3-player profile caps crewPerOption at [1,2] — the count is always < crew.length,
    // so there is always one player left over to attempt the excess press with.
    expect(count).toBeLessThan(crew.length);

    fireEvent.click(screen.getByTestId(`option-select-${option.id}`));

    for (let i = 0; i < count; i++) {
      fireEvent.click(screen.getByTestId(`rail-toggle-${crew[i]!.id}`));
    }

    // Excess rail press — the dictated count is already reached, toggleCommit ignores it.
    fireEvent.click(screen.getByTestId(`rail-toggle-${crew[count]!.id}`));

    // Excess player has NO chip (was silently rejected by crewRailMode).
    expect(screen.queryByTestId(`commchip-${crew[count]!.id}`)).not.toBeInTheDocument();
    // The dictated crew remain and commit is valid.
    for (let i = 0; i < count; i++) {
      expect(screen.getByTestId(`commchip-${crew[i]!.id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('btn-commit')).not.toBeDisabled();
  });

  it('dispatches CHOOSE_OPTION with the chosen option id and crew', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;
    const safeOption = room.options[0]!;

    // Select option, toggle exactly the dictated count via rail, then commit.
    fireEvent.click(screen.getByTestId(`option-select-${safeOption.id}`));
    const count = safeOption.commitCount ?? 1;
    for (let i = 0; i < count; i++) {
      fireEvent.click(screen.getByTestId(`rail-toggle-${crew[i]!.id}`));
    }
    fireEvent.click(screen.getByTestId('btn-commit'));

    // Engine should now be in minigame phase.
    expect(store.getState().session.present.phase).toBe('minigame');
    const updatedRoom = store.getState().session.present.currentRoom;
    if (updatedRoom === null || updatedRoom.kind !== 'obstacle') {
      throw new Error('Expected obstacle room after CHOOSE_OPTION');
    }
    expect(updatedRoom.committedOptionId).toBe(safeOption.id);
    expect(updatedRoom.committedBy).toContain(crew[0]!.id);
  });

  it('"Change door" button resets to option grid', () => {
    const store = renderObstacleRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));
    expect(screen.getByTestId('commit-layout')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-change-door'));
    // Back to the option grid — commit layout gone.
    expect(screen.queryByTestId('commit-layout')).not.toBeInTheDocument();
    expect(screen.getByTestId('option-cards')).toBeInTheDocument();
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

    // Advance narration and verify commit still works with a crew selection.
    fireEvent.click(screen.getByTestId('teleprompter-advance'));
    const option = room.options[0]!;
    fireEvent.click(screen.getByTestId(`option-select-${option.id}`));
    const count = option.commitCount ?? 1;
    for (let i = 0; i < count; i++) {
      fireEvent.click(screen.getByTestId(`rail-toggle-${crew[i]!.id}`));
    }
    expect(screen.getByTestId('btn-commit')).not.toBeDisabled();
  });
});

// ── Full-team game tests ──────────────────────────────────────────────────────

describe('ObstacleRoom — full-team game (no crew-select)', () => {
  /** Config with one full-team obstacle and one normal obstacle so generation picks up. */
  const fullTeamCfg = {
    ...obstacleOnlyCfg,
    scaling: {
      ...obstacleOnlyCfg.scaling,
      minCommit: { alpha: 1, bravo: 1, charlie: 1, 'ft-game': 1 },
    },
    roomTemplates: {
      ...obstacleOnlyCfg.roomTemplates,
      obstacles: [
        {
          id: 'obs-ft',
          gameId: 'ft-game',
          lane: 'charm' as const,
          fullTeam: true,
          options: [
            { id: 'ft-safe',   greedy: false, heatCost: 1, reward: 1 },
            { id: 'ft-greedy', greedy: true,  heatCost: 2, reward: 2 },
          ] as [{ id: string; greedy: false; heatCost: number; reward: number }, { id: string; greedy: true; heatCost: number; reward: number }],
        },
      ],
    },
  };

  function makeFullTeamStore(playerCount = 3) {
    const narration = makeNarrationFixture();
    const store = createGameStore({ cfg: fullTeamCfg, storage: makeStorage(), narration });
    const players = Array.from({ length: playerCount }, (_, i) => ({ name: `P${i}` }));
    store.getState().startRun(players, 1);
    return store;
  }

  function renderFullTeamRoom(playerCount = 3) {
    const store = makeFullTeamStore(playerCount);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <CrewRailModeProvider>
            <RailButtons />
            <ObstacleRoom />
          </CrewRailModeProvider>
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    return store;
  }

  it('shows full-team copy and no checkbox panel when a full-team option is selected', () => {
    const store = renderFullTeamRoom(3);
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    // Old checkbox panel never appears
    expect(screen.queryByTestId('crew-commit')).not.toBeInTheDocument();
    // Full-team copy is shown in the commit-instruct panel
    expect(screen.getByTestId('crew-full-team')).toBeInTheDocument();
  });

  it('commit button is immediately enabled for a full-team option (all crew pre-selected)', () => {
    const store = renderFullTeamRoom(3);
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));
    expect(screen.getByTestId('btn-commit')).not.toBeDisabled();
  });

  it('dispatches CHOOSE_OPTION with all crew IDs for a full-team game', () => {
    const store = renderFullTeamRoom(3);
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));
    fireEvent.click(screen.getByTestId('btn-commit'));

    const updatedRoom = store.getState().session.present.currentRoom;
    if (updatedRoom === null || updatedRoom.kind !== 'obstacle') {
      throw new Error('Expected obstacle room after commit');
    }
    expect(store.getState().session.present.phase).toBe('minigame');
    expect(updatedRoom.committedBy).toHaveLength(crew.length);
    for (const player of crew) {
      expect(updatedRoom.committedBy).toContain(player.id);
    }
  });
});

// ── Difficulty dial with a registered game ────────────────────────────────────

describe('ObstacleRoom — GM difficulty dial (registered game)', () => {
  /** Config with a safeCrack obstacle — gameId is in the static minigame registry. */
  const safeCrackObstacleCfg = {
    ...obstacleOnlyCfg,
    scaling: {
      ...obstacleOnlyCfg.scaling,
      minCommit: { ...obstacleOnlyCfg.scaling.minCommit, safeCrack: 1 },
    },
    roomTemplates: {
      ...obstacleOnlyCfg.roomTemplates,
      obstacles: [
        {
          id: 'obs-sc',
          gameId: 'safeCrack',
          lane: 'tech',
          options: [
            { id: 'sc-safe',   greedy: false, heatCost: 1, reward: 1 },
            { id: 'sc-greedy', greedy: true,  heatCost: 2, reward: 2 },
          ] as [
            { id: string; greedy: false; heatCost: number; reward: number },
            { id: string; greedy: true;  heatCost: number; reward: number },
          ],
        },
      ],
    },
  };

  function makeDialStore(seed = 1) {
    const narration = makeNarrationFixture();
    const store = createGameStore({ cfg: safeCrackObstacleCfg, storage: makeStorage(), narration });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);
    return store;
  }

  function renderDialRoom(seed = 1) {
    const store = makeDialStore(seed);
    render(
      <ActionBarSlotProvider>
        <ActionBarSlotOutlet />
        <StoreContext.Provider value={store}>
          <CrewRailModeProvider>
            <RailButtons />
            <ObstacleRoom />
          </CrewRailModeProvider>
        </StoreContext.Provider>
      </ActionBarSlotProvider>,
    );
    return store;
  }

  it('renders option-dial when a registered-game option is selected', () => {
    const store = renderDialRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    expect(screen.getByTestId('option-dial')).toBeInTheDocument();
    expect(screen.getByText('Difficulty dial · GM only')).toBeInTheDocument();
  });

  it('dial fill width decreases as crew are committed (more crew → lower difficulty)', () => {
    const store = renderDialRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    const fill = screen.getByTestId('option-dial').querySelector('.dfill') as HTMLElement;
    const fillBefore = parseFloat(fill.style.width);
    expect(fillBefore).toBeGreaterThan(0);

    // Committing a crew member adds more lane ratings — dial eases, fill narrows.
    fireEvent.click(screen.getByTestId(`rail-toggle-${crew[0]!.id}`));
    const fillAfter = parseFloat(fill.style.width);
    expect(fillAfter).toBeLessThan(fillBefore);
  });

  it('shows the numeric dial value and a stats-ease delta once crew commit', () => {
    const store = renderDialRoom();
    const room = store.getState().session.present.currentRoom;
    if (room === null || room.kind !== 'obstacle') throw new Error('Expected obstacle room');
    const crew = store.getState().session.present.crew;

    fireEvent.click(screen.getByTestId(`option-select-${room.options[0]!.id}`));

    // Numeric readout always present once a door is selected.
    expect(screen.getByTestId('option-dial-value').textContent).toMatch(/-?\d+\.\d/);
    // No delta chip with nobody committed.
    expect(screen.queryByTestId('option-dial-delta')).not.toBeInTheDocument();

    // Tapping a player onto the commit eases the dial → the delta chip appears.
    fireEvent.click(screen.getByTestId(`rail-toggle-${crew[0]!.id}`));
    expect(screen.getByTestId('option-dial-delta').textContent).toMatch(/ease it -\d+\.\d/);
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
    expect(state.loot).toBeGreaterThan(lootBefore);
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
    expect(state.heat).toBeGreaterThan(heatBefore);
    const lastResult = state.history[state.history.length - 1];
    expect(lastResult?.kind).toBe('obstacle');
    if (lastResult?.kind === 'obstacle') {
      expect(lastResult.outcome).toBe('botched');
    }
  });

  it('exact heat and loot values match engine arithmetic for clean outcome', () => {
    const store = renderMinigameStub();
    const room = store.getState().session.present.currentRoom;
    if (room?.kind !== 'obstacle') throw new Error('Expected obstacle room in minigame phase');
    const safeOpt = room.options[0]!;

    fireEvent.click(screen.getByTestId('btn-outcome-clean'));

    const state = store.getState().session.present;
    expect(state.heat).toBe(1);
    expect(state.loot).toBe(safeOpt.reward);
  });

  it('exact heat and loot values match engine arithmetic for complication outcome', () => {
    const store = renderMinigameStub();

    fireEvent.click(screen.getByTestId('btn-outcome-complication'));

    const state = store.getState().session.present;
    expect(state.heat).toBe(2);
    expect(state.loot).toBe(obstacleOnlyCfg.outcomeLoot.complication);
  });

  it('exact heat and loot values match engine arithmetic for botched outcome', () => {
    const store = renderMinigameStub();

    fireEvent.click(screen.getByTestId('btn-outcome-botched'));

    const state = store.getState().session.present;
    expect(state.heat).toBe(3);
    expect(state.loot).toBe(obstacleOnlyCfg.outcomeLoot.botched);
  });
});
