// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
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

/** Layout shell that mirrors app.tsx: Hud always mounted, PhaseRouter as sibling. */
function HudWithPhaseRouter() {
  const phase = useGameStore(s => s.session.present.phase);
  return (
    <>
      <Hud />
      <PhaseRouter phase={phase} />
    </>
  );
}

// ── HeatTrack tests ───────────────────────────────────────────────────────────

describe('HUD — HeatTrack', () => {
  it('uses hMax from cfg, not a hardcoded literal', async () => {
    // Config with hMax=10 verifies the track is not hardcoded to 20.
    const customCfg = { ...testCfg, heat: { ...testCfg.heat, hMax: 10 } };
    const storage = makeStorage();
    const store = createGameStore({ cfg: customCfg, storage });

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

    // heat=0 after START_RUN → all 10 slots are empty (none filled)
    expect(screen.queryAllByTestId('heat-slot-filled')).toHaveLength(0);
    expect(screen.getAllByTestId('heat-slot-empty')).toHaveLength(10);
  });

  it('shows the correct filled/face-down split for current heat', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 42);
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 7 });
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <Hud />
        </StoreContext.Provider>,
      );
    });

    expect(screen.getAllByTestId('heat-slot-filled')).toHaveLength(7);
    expect(screen.getAllByTestId('heat-slot-empty')).toHaveLength(testCfg.heat.hMax - 7);
  });

  it('shows 0 filled slots when heat is 0', async () => {
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

    expect(screen.queryAllByTestId('heat-slot-filled')).toHaveLength(0);
    expect(screen.getAllByTestId('heat-slot-empty')).toHaveLength(testCfg.heat.hMax);
  });

  it('updates filled slots reactively when heat changes', async () => {
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

    expect(screen.queryAllByTestId('heat-slot-filled')).toHaveLength(0);

    await act(async () => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 5 });
    });

    expect(screen.getAllByTestId('heat-slot-filled')).toHaveLength(5);
    expect(screen.getAllByTestId('heat-slot-empty')).toHaveLength(testCfg.heat.hMax - 5);
  });
});

// ── Loot tests ────────────────────────────────────────────────────────────────

describe('HUD — Loot', () => {
  it('shows 0 loot at the start of a run', async () => {
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

    expect(screen.getByTestId('loot-total').textContent).toBe('0');
  });

  it('shows the correct loot total after an override', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 42);
      store.getState().dispatch({ t: 'OVERRIDE_SET_LOOT', value: 12 });
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <Hud />
        </StoreContext.Provider>,
      );
    });

    expect(screen.getByTestId('loot-total').textContent).toBe('12');
  });

  it('updates loot total reactively when loot changes', async () => {
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

    expect(screen.getByTestId('loot-total').textContent).toBe('0');

    await act(async () => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_LOOT', value: 8 });
    });

    expect(screen.getByTestId('loot-total').textContent).toBe('8');
  });
});

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
