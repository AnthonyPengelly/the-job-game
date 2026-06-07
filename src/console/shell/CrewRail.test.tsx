// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { PlayerId } from '@/engine';
import { CrewRail } from './CrewRail';
import { CrewRailModeProvider, useCrewRailMode } from './crewRailMode';

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

function makeStore(names = ['Alice', 'Bob']) {
  const storage = makeStorage();
  const store = createGameStore({ cfg: testCfg, storage });
  store.getState().startRun(names.map(name => ({ name })), 1);
  return store;
}

function renderCrewRail(store: ReturnType<typeof createGameStore>) {
  return render(
    <StoreContext.Provider value={store}>
      <CrewRailModeProvider>
        <CrewRail />
      </CrewRailModeProvider>
    </StoreContext.Provider>,
  );
}

// ── Crew avatar display ───────────────────────────────────────────────────────

describe('CrewRail — avatar display', () => {
  it('renders an avatar for every crew member', async () => {
    const store = makeStore(['Alice', 'Bob', 'Eve']);
    await act(async () => { renderCrewRail(store); });

    expect(screen.getByTestId('crew-member-player-0')).toBeInTheDocument();
    expect(screen.getByTestId('crew-member-player-1')).toBeInTheDocument();
    expect(screen.getByTestId('crew-member-player-2')).toBeInTheDocument();
  });

  it('shows player name', async () => {
    const store = makeStore(['Alice', 'Bob']);
    await act(async () => { renderCrewRail(store); });

    expect(screen.getByTestId('crew-name-player-0')).toHaveTextContent('Alice');
    expect(screen.getByTestId('crew-name-player-1')).toHaveTextContent('Bob');
  });

  it('shows all four lane stats for each player', async () => {
    const store = makeStore(['Alice']);
    await act(async () => { renderCrewRail(store); });

    expect(screen.getByTestId('crew-stat-player-0-tech')).toBeInTheDocument();
    expect(screen.getByTestId('crew-stat-player-0-physical')).toBeInTheDocument();
    expect(screen.getByTestId('crew-stat-player-0-charm')).toBeInTheDocument();
    expect(screen.getByTestId('crew-stat-player-0-stealth')).toBeInTheDocument();
  });

  it('marks a resting crew member as exhausted', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const playerId = 'player-0' as PlayerId;

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      store.getState().dispatch({ t: 'OVERRIDE_SET_RESTING', player: playerId, untilRoom: 5 });
    });
    await act(async () => { renderCrewRail(store); });

    expect(screen.getByTestId(`crew-exhausted-${playerId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`crew-member-${playerId}`)).toHaveAttribute('data-out', 'true');
  });

  it('clears exhausted state when resting is removed', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const playerId = 'player-0' as PlayerId;

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      store.getState().dispatch({ t: 'OVERRIDE_SET_RESTING', player: playerId, untilRoom: 5 });
    });
    await act(async () => { renderCrewRail(store); });

    expect(screen.getByTestId(`crew-exhausted-${playerId}`)).toBeInTheDocument();

    await act(async () => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_RESTING', player: playerId });
    });

    expect(screen.queryByTestId(`crew-exhausted-${playerId}`)).toBeNull();
  });

  it('shows power-up pips when a player has power-ups', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const playerId = 'player-0' as PlayerId;

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: playerId, lane: 'tech', held: true });
    });
    await act(async () => { renderCrewRail(store); });

    expect(screen.getByTestId(`crew-powerup-${playerId}-tech`)).toBeInTheDocument();
  });

  it('renders the crew-rail testid', async () => {
    const store = makeStore();
    await act(async () => { renderCrewRail(store); });

    expect(screen.getByTestId('crew-rail')).toBeInTheDocument();
  });

  it('renders the open-player-view button', async () => {
    const store = makeStore();
    await act(async () => { renderCrewRail(store); });

    expect(screen.getByTestId('open-player-view')).toBeInTheDocument();
  });

  it('calls window.open with player.html on player-view click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const store = makeStore();
    await act(async () => { renderCrewRail(store); });

    fireEvent.click(screen.getByTestId('open-player-view'));
    expect(openSpy).toHaveBeenCalledWith('player.html', 'the-job-player');

    openSpy.mockRestore();
  });
});

// ── Popover: opens on avatar click ────────────────────────────────────────────

describe('CrewRail — detail popover', () => {
  it('opens the per-player popover when an avatar is clicked', async () => {
    const store = makeStore(['Alice', 'Bob']);
    await act(async () => { renderCrewRail(store); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });

    expect(screen.getByTestId('crew-detail-popover-player-0')).toBeInTheDocument();
  });

  it('closes the popover when the same avatar is clicked again', async () => {
    const store = makeStore(['Alice']);
    await act(async () => { renderCrewRail(store); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    expect(screen.getByTestId('crew-detail-popover-player-0')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    expect(screen.queryByTestId('crew-detail-popover-player-0')).toBeNull();
  });

  it('closes the popover when the X button is clicked', async () => {
    const store = makeStore(['Alice']);
    await act(async () => { renderCrewRail(store); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    expect(screen.getByTestId('crew-detail-popover-player-0')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-detail-close-player-0'));
    });
    expect(screen.queryByTestId('crew-detail-popover-player-0')).toBeNull();
  });

  it('popover shows stat controls for the player', async () => {
    const store = makeStore(['Alice']);
    await act(async () => { renderCrewRail(store); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });

    expect(screen.getByTestId('override-stat-row-player-0-tech')).toBeInTheDocument();
    expect(screen.getByTestId('btn-override-stat-plus-player-0-tech')).toBeInTheDocument();
    expect(screen.getByTestId('btn-override-stat-minus-player-0-tech')).toBeInTheDocument();
  });

  it('popover stat +1 button dispatches OVERRIDE_ADJUST_STAT', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    const dispatch = vi.spyOn(store.getState(), 'dispatch');

    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <CrewRailModeProvider>
            <CrewRail />
          </CrewRailModeProvider>
        </StoreContext.Provider>,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-override-stat-plus-player-0-tech'));
    });

    expect(dispatch).toHaveBeenCalledWith({
      t: 'OVERRIDE_ADJUST_STAT',
      player: 'player-0',
      lane: 'tech',
      delta: 1,
    });
  });

  it('popover power-up toggle dispatches OVERRIDE_SET_POWERUP', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    const dispatch = vi.spyOn(store.getState(), 'dispatch');

    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <CrewRailModeProvider>
            <CrewRail />
          </CrewRailModeProvider>
        </StoreContext.Provider>,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-override-powerup-player-0-charm'));
    });

    expect(dispatch).toHaveBeenCalledWith({
      t: 'OVERRIDE_SET_POWERUP',
      player: 'player-0',
      lane: 'charm',
      held: true,
    });
  });

  it('popover rest controls dispatch OVERRIDE_SET_RESTING', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    const dispatch = vi.spyOn(store.getState(), 'dispatch');

    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <CrewRailModeProvider>
            <CrewRail />
          </CrewRailModeProvider>
        </StoreContext.Provider>,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });

    // Enter a rest room number and click "Set rest"
    const restInput = screen.getByTestId('override-resting-input-player-0');
    await act(async () => {
      fireEvent.change(restInput, { target: { value: '3' } });
      fireEvent.click(screen.getByTestId('btn-override-set-resting-player-0'));
    });

    expect(dispatch).toHaveBeenCalledWith({
      t: 'OVERRIDE_SET_RESTING',
      player: 'player-0',
      untilRoom: 3,
    });
  });
});

// ── Internal scroll at 7 players ──────────────────────────────────────────────

describe('CrewRail — 7 players scroll', () => {
  it('renders all 7 avatars without throwing', async () => {
    const store = makeStore(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    await act(async () => { renderCrewRail(store); });

    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`crew-member-player-${i}`)).toBeInTheDocument();
    }
  });

  it('the avatar list is inside the scrollable body (not at document root)', async () => {
    const store = makeStore(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    await act(async () => { renderCrewRail(store); });

    const body = document.querySelector('.cockpit-crewrail-body');
    const firstAvatar = screen.getByTestId('crew-member-player-0');
    expect(body).not.toBeNull();
    expect(body!.contains(firstAvatar)).toBe(true);
  });
});

// ── Commit mode ───────────────────────────────────────────────────────────────

/** Helper: renders CrewRail and exposes the mode context controls via a sibling. */
function ControlledCrewRail({
  store,
  onMount,
}: {
  store: ReturnType<typeof createGameStore>;
  onMount: (ctx: ReturnType<typeof useCrewRailMode>) => void;
}) {
  function ModeCapture() {
    const ctx = useCrewRailMode();
    onMount(ctx);
    return null;
  }
  return (
    <StoreContext.Provider value={store}>
      <CrewRailModeProvider>
        <ModeCapture />
        <CrewRail />
      </CrewRailModeProvider>
    </StoreContext.Provider>
  );
}

describe('CrewRail — commit mode', () => {
  it('clicking an avatar in commit mode adds it to the committed set', async () => {
    const store = makeStore(['Alice', 'Bob', 'Eve']);
    let railCtx!: ReturnType<typeof useCrewRailMode>;

    await act(async () => {
      render(
        <ControlledCrewRail
          store={store}
          onMount={ctx => { railCtx = ctx; }}
        />,
      );
    });

    await act(async () => { railCtx.activateCommit(1, 2); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });

    expect(railCtx.committed.has('player-0' as PlayerId)).toBe(true);
    expect(screen.getByTestId('crew-member-player-0')).toHaveClass('selected-commit');
  });

  it('clicking a committed avatar in commit mode deselects it', async () => {
    const store = makeStore(['Alice', 'Bob']);
    let railCtx!: ReturnType<typeof useCrewRailMode>;

    await act(async () => {
      render(
        <ControlledCrewRail
          store={store}
          onMount={ctx => { railCtx = ctx; }}
        />,
      );
    });

    await act(async () => { railCtx.activateCommit(1, 2); });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    expect(railCtx.committed.has('player-0' as PlayerId)).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    expect(railCtx.committed.has('player-0' as PlayerId)).toBe(false);
  });

  it('does not exceed maxCommit', async () => {
    const store = makeStore(['Alice', 'Bob', 'Eve']);
    let railCtx!: ReturnType<typeof useCrewRailMode>;

    await act(async () => {
      render(
        <ControlledCrewRail
          store={store}
          onMount={ctx => { railCtx = ctx; }}
        />,
      );
    });

    await act(async () => { railCtx.activateCommit(1, 1); });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-1'));
    });

    // max is 1, so player-1 should NOT be added
    expect(railCtx.committed.has('player-0' as PlayerId)).toBe(true);
    expect(railCtx.committed.has('player-1' as PlayerId)).toBe(false);
  });

  it('does not open the detail popover in commit mode', async () => {
    const store = makeStore(['Alice', 'Bob']);
    let railCtx!: ReturnType<typeof useCrewRailMode>;

    await act(async () => {
      render(
        <ControlledCrewRail
          store={store}
          onMount={ctx => { railCtx = ctx; }}
        />,
      );
    });

    await act(async () => { railCtx.activateCommit(1, 2); });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });

    // Popover should NOT open in commit mode
    expect(screen.queryByTestId('crew-detail-popover-player-0')).toBeNull();
  });
});

// ── Attempter mode ────────────────────────────────────────────────────────────

describe('CrewRail — attempter mode', () => {
  it('clicking an avatar in attempter mode selects it as the attempter', async () => {
    const store = makeStore(['Alice', 'Bob']);
    let railCtx!: ReturnType<typeof useCrewRailMode>;

    await act(async () => {
      render(
        <ControlledCrewRail
          store={store}
          onMount={ctx => { railCtx = ctx; }}
        />,
      );
    });

    await act(async () => { railCtx.activateAttempter(); });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });

    expect(railCtx.selectedAttempter).toBe('player-0' as PlayerId);
    expect(screen.getByTestId('crew-member-player-0')).toHaveClass('selected-attempter');
  });

  it('clicking a different avatar replaces the attempter selection', async () => {
    const store = makeStore(['Alice', 'Bob']);
    let railCtx!: ReturnType<typeof useCrewRailMode>;

    await act(async () => {
      render(
        <ControlledCrewRail
          store={store}
          onMount={ctx => { railCtx = ctx; }}
        />,
      );
    });

    await act(async () => { railCtx.activateAttempter(); });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-1'));
    });

    expect(railCtx.selectedAttempter).toBe('player-1' as PlayerId);
    expect(screen.getByTestId('crew-member-player-1')).toHaveClass('selected-attempter');
    expect(screen.getByTestId('crew-member-player-0')).not.toHaveClass('selected-attempter');
  });

  it('does not open the detail popover in attempter mode', async () => {
    const store = makeStore(['Alice', 'Bob']);
    let railCtx!: ReturnType<typeof useCrewRailMode>;

    await act(async () => {
      render(
        <ControlledCrewRail
          store={store}
          onMount={ctx => { railCtx = ctx; }}
        />,
      );
    });

    await act(async () => { railCtx.activateAttempter(); });
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });

    expect(screen.queryByTestId('crew-detail-popover-player-0')).toBeNull();
  });
});

// ── Gear drop ─────────────────────────────────────────────────────────────────

describe('CrewRail — gear drop', () => {
  it('dropping gear on an avatar dispatches ASSIGN_GEAR', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    // Mock dispatch so the gear event doesn't reach the engine (test config has no gear).
    const captured: unknown[] = [];
    const dispatch = vi.spyOn(store.getState(), 'dispatch').mockImplementation(event => {
      captured.push(event);
    });

    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <CrewRailModeProvider>
            <CrewRail />
          </CrewRailModeProvider>
        </StoreContext.Provider>,
      );
    });

    const avatar = screen.getByTestId('crew-member-player-0');
    await act(async () => {
      fireEvent.dragOver(avatar, {
        dataTransfer: { dropEffect: '' },
      });
      fireEvent.drop(avatar, {
        dataTransfer: { getData: (type: string) => type === 'application/x-gear-id' ? 'some-gear-id' : '' },
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      t: 'ASSIGN_GEAR',
      gear: 'some-gear-id',
      to: 'player-0',
    });
    dispatch.mockRestore();
    void captured;
  });
});
