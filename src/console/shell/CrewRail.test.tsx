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

    // Open with a realistic browser event sequence (mousedown then click)
    const avatar = screen.getByTestId('crew-member-player-0');
    await act(async () => {
      fireEvent.mouseDown(avatar);
      fireEvent.click(avatar);
    });
    expect(screen.getByTestId('crew-detail-popover-player-0')).toBeInTheDocument();

    // Second mousedown on the same avatar fires the Popover's capture-phase
    // outside-click listener. The excludeRef (railRef) must exclude the avatar
    // so onClose() is NOT called, leaving the toggle in handleAvatarClick free
    // to set state to null. Without excludeRef the listener would call onClose()
    // and the subsequent click would reopen the popover instead of closing it.
    await act(async () => {
      fireEvent.mouseDown(avatar);
      fireEvent.click(avatar);
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
    expect(screen.getByTestId('crew-member-player-0')).toHaveClass('commit-on');
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
    expect(screen.getByTestId('crew-member-player-0')).toHaveClass('commit-on');
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
    expect(screen.getByTestId('crew-member-player-1')).toHaveClass('commit-on');
    expect(screen.getByTestId('crew-member-player-0')).not.toHaveClass('commit-on');
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

// ── State labels ──────────────────────────────────────────────────────────────

describe('CrewRail — state labels', () => {
  it('shows GOING for committed and PICK for uncommitted in commit mode', async () => {
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

    expect(screen.getByTestId('crew-state-player-0')).toHaveTextContent('GOING');
    expect(screen.getByTestId('crew-state-player-1')).toHaveTextContent('PICK');
  });

  it('shows ATTEMPTS for the attempter and PICK for others in attempter mode', async () => {
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

    expect(screen.getByTestId('crew-state-player-0')).toHaveTextContent('ATTEMPTS');
    expect(screen.getByTestId('crew-state-player-1')).toHaveTextContent('PICK');
  });

  it('shows RESTS for a resting member in commit mode and does not allow selecting them', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const playerId = 'player-0' as PlayerId;

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      store.getState().dispatch({ t: 'OVERRIDE_SET_RESTING', player: playerId, untilRoom: 5 });
    });

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

    expect(screen.getByTestId('crew-state-player-0')).toHaveTextContent('RESTS');

    // Clicking a resting member should NOT add them to committed
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    expect(railCtx.committed.has(playerId)).toBe(false);
  });

  it('shows RESTS for a resting member in attempter mode and does not allow selecting them', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const playerId = 'player-0' as PlayerId;

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      store.getState().dispatch({ t: 'OVERRIDE_SET_RESTING', player: playerId, untilRoom: 5 });
    });

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

    expect(screen.getByTestId('crew-state-player-0')).toHaveTextContent('RESTS');

    // Clicking a resting member should NOT set them as attempter
    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });
    expect(railCtx.selectedAttempter).toBeNull();
  });

  it('shows READY in idle mode for a non-resting member', async () => {
    const store = makeStore(['Alice']);
    await act(async () => { renderCrewRail(store); });

    expect(screen.getByTestId('crew-state-player-0')).toHaveTextContent('READY');
  });
});

// ── Pick state CSS classes ─────────────────────────────────────────────────────

describe('CrewRail — pick state CSS classes', () => {
  it('non-committed members get "pick" class in commit mode', async () => {
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

    // player-1 is not committed yet — should have 'pick' class
    expect(screen.getByTestId('crew-member-player-1')).toHaveClass('pick');
  });

  it('non-selected members get "pick" class in attempter mode', async () => {
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

    // Before picking: both are 'pick'
    expect(screen.getByTestId('crew-member-player-0')).toHaveClass('pick');
    expect(screen.getByTestId('crew-member-player-1')).toHaveClass('pick');

    await act(async () => {
      fireEvent.click(screen.getByTestId('crew-member-player-0'));
    });

    // player-0 is now 'commit-on'; player-1 is still 'pick'
    expect(screen.getByTestId('crew-member-player-0')).toHaveClass('commit-on');
    expect(screen.getByTestId('crew-member-player-1')).toHaveClass('pick');
  });
});

// ── Lane stats redesign ───────────────────────────────────────────────────────

describe('CrewRail — lane stats and power-up pips', () => {
  it('renders hot lane when player has a power-up for that lane', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const playerId = 'player-0' as PlayerId;

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: playerId, lane: 'tech', held: true });
    });
    await act(async () => { renderCrewRail(store); });

    // The tech lane cell should have 'hot' class
    const techStat = screen.getByTestId(`crew-stat-${playerId}-tech`);
    expect(techStat.closest('.lane')).toHaveClass('hot');
  });

  it('renders four pip cells (all lanes)', async () => {
    const store = makeStore(['Alice']);
    await act(async () => { renderCrewRail(store); });

    // All four pips should be in the DOM (even inactive ones)
    const pipsContainer = screen.getByTestId('crew-powerups-player-0');
    expect(pipsContainer.querySelectorAll('.pip').length).toBe(4);
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
