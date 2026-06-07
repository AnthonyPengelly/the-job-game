// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { StoreContext, useGameStore } from '@/console/store';
import { createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { PlayerId, RunPhase } from '@/engine';
import { PhaseRouter } from '@/console/screens';
import { Hud } from './Hud';

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

/** Layout shell that mirrors the cockpit structure: Hud in a rail, PhaseRouter as sibling. */
function HudWithPhaseRouter() {
  const phase = useGameStore(s => s.session.present.phase);
  return (
    <>
      <Hud />
      <PhaseRouter phase={phase} />
    </>
  );
}

// ── CrewPanel tests ───────────────────────────────────────────────────────────

describe('HUD — CrewPanel', () => {
  it('renders all crew members', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Eve' }], 1);
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <Hud />
        </StoreContext.Provider>,
      );
    });

    expect(screen.getByTestId('crew-member-player-0')).toBeInTheDocument();
    expect(screen.getByTestId('crew-member-player-1')).toBeInTheDocument();
    expect(screen.getByTestId('crew-member-player-2')).toBeInTheDocument();
  });

  it('renders a resting crew member as exhausted', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const playerId = 'player-0' as PlayerId;

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      // roomIndex=0 after START_RUN; resting until room 5 → isResting=true (0 ≤ 5)
      store.getState().dispatch({
        t: 'OVERRIDE_SET_RESTING',
        player: playerId,
        untilRoom: 5,
      });
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <Hud />
        </StoreContext.Provider>,
      );
    });

    expect(screen.getByTestId(`crew-exhausted-${playerId}`)).toBeInTheDocument();
  });

  it('does not render a non-resting crew member as exhausted', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const playerId = 'player-0' as PlayerId;

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <Hud />
        </StoreContext.Provider>,
      );
    });

    expect(screen.queryByTestId(`crew-exhausted-${playerId}`)).toBeNull();
  });

  it('clears the exhausted indicator when a player stops resting', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const playerId = 'player-0' as PlayerId;

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      store.getState().dispatch({
        t: 'OVERRIDE_SET_RESTING',
        player: playerId,
        untilRoom: 5,
      });
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <Hud />
        </StoreContext.Provider>,
      );
    });

    expect(screen.getByTestId(`crew-exhausted-${playerId}`)).toBeInTheDocument();

    // Clear the resting state (untilRoom absent)
    await act(async () => {
      store.getState().dispatch({
        t: 'OVERRIDE_SET_RESTING',
        player: playerId,
      });
    });

    expect(screen.queryByTestId(`crew-exhausted-${playerId}`)).toBeNull();
  });
});

// ── Layout: HUD stays mounted across phase changes ────────────────────────────

describe('HUD — stays mounted across phase changes', () => {
  it('remains in the DOM when the phase changes (Hud is not phase-gated)', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <Hud />
        </StoreContext.Provider>,
      );
    });

    expect(screen.getByTestId('hud')).toBeInTheDocument();

    await act(async () => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase: 'offer' });
    });
    expect(screen.getByTestId('hud')).toBeInTheDocument();

    await act(async () => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase: 'result' });
    });
    expect(screen.getByTestId('hud')).toBeInTheDocument();
  });

  it('Hud and PhaseRouter are siblings — both present simultaneously', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <HudWithPhaseRouter />
        </StoreContext.Provider>,
      );
    });

    // Both the HUD and the phase screen are present together
    expect(screen.getByTestId('hud')).toBeInTheDocument();
    expect(screen.getByTestId('screen-briefing')).toBeInTheDocument();

    const phases: RunPhase[] = ['briefing', 'offer', 'getaway', 'result'];
    const phaseTestIds: Record<RunPhase, string> = {
      briefing: 'screen-briefing',
      room: 'screen-room',
      minigame: 'screen-minigame',
      offer: 'screen-offer',
      getaway: 'screen-getaway',
      result: 'screen-result',
    };

    for (const phase of phases) {
      await act(async () => {
        store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase });
      });
      // HUD is always present regardless of phase
      expect(screen.getByTestId('hud')).toBeInTheDocument();
      // The correct phase screen is also shown
      expect(screen.getByTestId(phaseTestIds[phase])).toBeInTheDocument();
    }
  });
});

// ── Player-view launcher ──────────────────────────────────────────────────────

describe('HUD — player-view launcher', () => {
  it('renders the open-player-view button', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <Hud />
        </StoreContext.Provider>,
      );
    });

    expect(screen.getByTestId('open-player-view')).toBeInTheDocument();
  });

  it('calls window.open with player.html and a named window on click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <Hud />
        </StoreContext.Provider>,
      );
    });

    fireEvent.click(screen.getByTestId('open-player-view'));

    expect(openSpy).toHaveBeenCalledOnce();
    expect(openSpy).toHaveBeenCalledWith('player.html', 'the-job-player');

    openSpy.mockRestore();
  });
});
