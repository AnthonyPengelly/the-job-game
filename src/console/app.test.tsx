// @vitest-environment jsdom
import { useEffect } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, useGameStore } from '@/console/store';
import { createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { SAVE_VERSION } from '@/content/schema/save';
import type { RunEvent, RunPhase } from '@/engine';
import { PhaseRouter, Setup } from '@/console/screens';
import { CrewRailModeProvider } from '@/console/shell';
import { App } from './app';

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

/**
 * AppShell rendered inside an existing StoreContext (no inner StoreProvider).
 * Mirrors the AppShell routing logic from app.tsx. Accepts a skipHydrate flag
 * so pre-seeded-store tests don't re-hydrate and overwrite the injected state.
 */
function AppShellForTest({ skipHydrate = false }: { skipHydrate?: boolean }) {
  const hydrate = useGameStore(s => s.hydrate);
  const crew = useGameStore(s => s.session.present.crew);
  const phase = useGameStore(s => s.session.present.phase);
  const hasResumableSave = useGameStore(s => s.hasResumableSave);

  useEffect(() => {
    if (!skipHydrate) hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showSetup = hasResumableSave || crew.length === 0;
  if (showSetup) return <Setup />;
  return <PhaseRouter phase={phase} />;
}

// ── Phase-router tests ────────────────────────────────────────────────────────

describe('Phase router', () => {
  it('renders Setup when no run is active and no save', async () => {
    const storage = makeStorage();
    await act(async () => {
      render(<App storeOptions={{ cfg: testCfg, storage }} />);
    });
    expect(screen.getByTestId('screen-setup')).toBeInTheDocument();
  });

  it('renders the Briefing screen after START_RUN', async () => {
    const storage = makeStorage();
    await act(async () => {
      render(<App storeOptions={{ cfg: testCfg, storage }} />);
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId('crew-size-select'), { target: { value: '2' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('player-name-0'), { target: { value: 'Alice' } });
      fireEvent.change(screen.getByTestId('player-name-1'), { target: { value: 'Bob' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-start-run'));
    });

    expect(screen.getByTestId('screen-briefing')).toBeInTheDocument();
  });

  it('PhaseRouter renders the correct screen for each RunPhase', () => {
    // Test the router in isolation: give it a store with crew set and no
    // resumable save so the routing logic shows PhaseRouter.
    const phaseMap: Array<{ phase: RunPhase; testId: string }> = [
      { phase: 'briefing', testId: 'screen-briefing' },
      { phase: 'room',     testId: 'screen-room' },
      { phase: 'minigame', testId: 'screen-minigame' },
      { phase: 'offer',    testId: 'screen-offer' },
      { phase: 'getaway',  testId: 'screen-getaway' },
      { phase: 'result',   testId: 'screen-result' },
    ];

    for (const { phase, testId } of phaseMap) {
      const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
      // Start a run so crew is populated, then override to the desired phase.
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
      store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase });

      // Render AppShellForTest with skipHydrate=true to avoid re-hydrating
      // from storage (which would set hasResumableSave=true and show Setup).
      render(
        <StoreContext.Provider value={store}>
          <CrewRailModeProvider>
            <AppShellForTest skipHydrate />
          </CrewRailModeProvider>
        </StoreContext.Provider>,
      );

      expect(screen.getByTestId(testId)).toBeInTheDocument();
      cleanup();
    }
  });
});

// ── Resume flow ───────────────────────────────────────────────────────────────

describe('Resume flow', () => {
  it('shows Resume/New when a valid save is present, Resume routes to active phase', async () => {
    const storage = makeStorage();
    const log: RunEvent[] = [
      { t: 'START_RUN', crew: [{ name: 'Alice' }, { name: 'Bob' }], seed: 7 },
    ];
    storage.setItem(
      'the-job:run-save',
      JSON.stringify({ version: SAVE_VERSION, seed: 7, eventLog: log }),
    );

    await act(async () => {
      render(<App storeOptions={{ cfg: testCfg, storage }} />);
    });

    expect(screen.getByTestId('btn-resume')).toBeInTheDocument();
    expect(screen.getByTestId('btn-new-job')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-resume'));
    });

    // After resume, app routes to briefing screen (phase='briefing' after START_RUN)
    expect(screen.getByTestId('screen-briefing')).toBeInTheDocument();
  });
});
