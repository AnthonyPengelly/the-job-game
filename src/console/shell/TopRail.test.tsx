// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { StoreContext } from '@/console/store';
import { createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { RunPhase } from '@/engine';
import { TopRail } from './TopRail';

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

// ── HeatTrack tests ───────────────────────────────────────────────────────────

describe('TopRail — HeatTrack', () => {
  it('uses hMax from cfg, not a hardcoded literal', async () => {
    const customCfg = { ...testCfg, heat: { ...testCfg.heat, hMax: 10 } };
    const storage = makeStorage();
    const store = createGameStore({ cfg: customCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <TopRail />
        </StoreContext.Provider>,
      );
    });

    // heat=0 after START_RUN → all 10 slots are empty (none filled)
    expect(screen.queryAllByTestId('heat-slot-filled')).toHaveLength(0);
    expect(screen.getAllByTestId('heat-slot-empty')).toHaveLength(10);
  });

  it('shows the correct filled/empty split for current heat', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 42);
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 7 });
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <TopRail />
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
          <TopRail />
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
          <TopRail />
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

describe('TopRail — Loot', () => {
  it('shows 0 loot at the start of a run', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <TopRail />
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
          <TopRail />
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
          <TopRail />
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

// ── Phase + room display ──────────────────────────────────────────────────────

describe('TopRail — phase and room display', () => {
  it('shows phase label in every phase', async () => {
    const phases: RunPhase[] = ['briefing', 'room', 'minigame', 'offer', 'getaway', 'result'];

    for (const phase of phases) {
      const storage = makeStorage();
      const store = createGameStore({ cfg: testCfg, storage });

      await act(async () => {
        store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
        store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase });
      });
      await act(async () => {
        render(
          <StoreContext.Provider value={store}>
            <TopRail />
          </StoreContext.Provider>,
        );
      });

      // Heat section should always be visible
      expect(screen.getByTestId('hud-heat-section')).toBeInTheDocument();
      // Loot section should always be visible
      expect(screen.getByTestId('hud-loot-section')).toBeInTheDocument();

      cleanup();
    }
  });

  it('shows the escape signal when escapeSignal is true', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });

    await act(async () => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      // escapeSignal requires roomIndex >= 2 AND heat >= runAtFraction * hMax.
      // Advance roomIndex to 2 via two skip overrides, then push heat above threshold.
      store.getState().dispatch({ t: 'OVERRIDE_SKIP_ROOM' });
      store.getState().dispatch({ t: 'OVERRIDE_SKIP_ROOM' });
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: testCfg.heat.hMax });
    });
    await act(async () => {
      render(
        <StoreContext.Provider value={store}>
          <TopRail />
        </StoreContext.Provider>,
      );
    });

    expect(screen.getByRole('status', { name: /escape signal active/i })).toBeInTheDocument();
    expect(screen.getByText('Getting hot')).toBeInTheDocument();
  });
});
