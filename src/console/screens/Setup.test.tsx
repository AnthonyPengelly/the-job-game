// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext } from '@/console/store';
import { createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { SAVE_VERSION } from '@/content/schema/save';
import { LEADERBOARD_VERSION } from '@/content/schema/leaderboard';
import type { RunEvent } from '@/engine';
import { Setup } from './Setup';

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

function renderSetup(storage: StorageLike) {
  const store = createGameStore({ cfg: testCfg, storage });
  store.getState().hydrate();
  render(
    <StoreContext.Provider value={store}>
      <Setup />
    </StoreContext.Provider>,
  );
  return store;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Setup — new run', () => {
  it('renders the crew-size selector with options 2–7', () => {
    renderSetup(makeStorage());
    const select = screen.getByTestId('crew-size-select');
    expect(select).toBeInTheDocument();
    const options = Array.from(select.querySelectorAll('option')).map(o => parseInt(o.value, 10));
    expect(options).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('renders name + quirk inputs for the default crew size (3)', () => {
    renderSetup(makeStorage());
    expect(screen.getByTestId('player-name-0')).toBeInTheDocument();
    expect(screen.getByTestId('player-name-1')).toBeInTheDocument();
    expect(screen.getByTestId('player-name-2')).toBeInTheDocument();
    expect(screen.getByTestId('player-quirk-0')).toBeInTheDocument();
  });

  it('adjusts the number of player rows when crew size changes', () => {
    renderSetup(makeStorage());
    const select = screen.getByTestId('crew-size-select');
    fireEvent.change(select, { target: { value: '5' } });
    expect(screen.getByTestId('player-name-4')).toBeInTheDocument();
    expect(screen.queryByTestId('player-name-5')).toBeNull();
  });

  it('dispatches START_RUN with entered names, quirk, and seed', () => {
    const storage = makeStorage();
    const store = renderSetup(storage);

    fireEvent.change(screen.getByTestId('player-name-0'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByTestId('player-quirk-0'), { target: { value: 'tech-ace' } });
    fireEvent.change(screen.getByTestId('player-name-1'), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByTestId('player-name-2'), { target: { value: 'Eve' } });
    fireEvent.change(screen.getByTestId('seed-input'), { target: { value: '42' } });

    fireEvent.click(screen.getByTestId('btn-start-run'));

    const { session, eventLog } = store.getState();
    expect(eventLog).toHaveLength(1);
    const startEvent = eventLog[0];
    expect(startEvent?.t).toBe('START_RUN');
    if (startEvent?.t === 'START_RUN') {
      expect(startEvent.crew[0]?.name).toBe('Alice');
      expect(startEvent.crew[0]?.quirk).toBe('tech-ace');
      expect(startEvent.crew[1]?.name).toBe('Bob');
      expect(startEvent.crew[2]?.name).toBe('Eve');
      expect(startEvent.seed).toBe(42);
    }
    // Engine processes START_RUN → phase='briefing'
    expect(session.present.phase).toBe('briefing');
  });

  it('dispatches START_RUN with a random non-negative seed when seed field is empty', () => {
    const storage = makeStorage();
    const store = renderSetup(storage);

    fireEvent.change(screen.getByTestId('player-name-0'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByTestId('player-name-1'), { target: { value: 'Bob' } });

    fireEvent.click(screen.getByTestId('btn-start-run'));

    const { eventLog } = store.getState();
    const startEvent = eventLog[0];
    expect(startEvent?.t).toBe('START_RUN');
    if (startEvent?.t === 'START_RUN') {
      // Empty seed field triggers random seed generation (Math.random >>> 0)
      expect(typeof startEvent.seed).toBe('number');
      expect(startEvent.seed).toBeGreaterThanOrEqual(0);
      expect(startEvent.seed).toBeLessThanOrEqual(0xFFFF_FFFF);
    }
  });
});

describe('Setup — resume flow', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = makeStorage();
    // Write a valid save so hydrate() sees a resumable save.
    const log: RunEvent[] = [
      { t: 'START_RUN', crew: [{ name: 'Alice' }, { name: 'Bob' }], seed: 99 },
    ];
    storage.setItem(
      'the-job:run-save',
      JSON.stringify({ version: SAVE_VERSION, seed: 99, eventLog: log }),
    );
  });

  it('shows Resume and New job buttons when a save is present', () => {
    renderSetup(storage);
    expect(screen.getByTestId('btn-resume')).toBeInTheDocument();
    expect(screen.getByTestId('btn-new-job')).toBeInTheDocument();
  });

  it('does not show the crew form by default when a save is present', () => {
    renderSetup(storage);
    expect(screen.queryByTestId('crew-size-select')).toBeNull();
  });

  it('Resume clears hasResumableSave so the app routes to the active phase', () => {
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().hydrate();

    render(
      <StoreContext.Provider value={store}>
        <Setup />
      </StoreContext.Provider>,
    );

    expect(store.getState().hasResumableSave).toBe(true);
    fireEvent.click(screen.getByTestId('btn-resume'));
    expect(store.getState().hasResumableSave).toBe(false);
    // The hydrated session phase should still reflect the saved run
    expect(store.getState().session.present.phase).toBe('briefing');
  });

  it('New job shows the crew form', () => {
    renderSetup(storage);
    fireEvent.click(screen.getByTestId('btn-new-job'));
    expect(screen.getByTestId('crew-size-select')).toBeInTheDocument();
  });
});

describe('Setup — leaderboard', () => {
  it('shows empty-state copy when no runs have been recorded', () => {
    renderSetup(makeStorage());
    expect(screen.getByText('Complete your first run to see scores here.')).toBeInTheDocument();
  });

  it('renders leaderboard entries with score, outcome, loot and crew size', () => {
    const storage = makeStorage();
    storage.setItem(
      'the-job:leaderboard',
      JSON.stringify({
        version: LEADERBOARD_VERSION,
        entries: [
          { runSeed: 1, score: 5000, loot: 12000, heatAtGetaway: 2, win: true,  crewSize: 3, finishedAt: 1000 },
          { runSeed: 2, score: 2500, loot:  6000, heatAtGetaway: 5, win: false, crewSize: 4, finishedAt: 2000 },
        ],
      }),
    );
    renderSetup(storage);
    expect(screen.getByText('$5k')).toBeInTheDocument();
    expect(screen.getByText('$2.5k')).toBeInTheDocument();
    expect(screen.getByText('WIN')).toBeInTheDocument();
    expect(screen.getByText('BUST')).toBeInTheDocument();
    // Loot formatted via formatLoot
    expect(screen.getByText('$12k · 3p')).toBeInTheDocument();
    expect(screen.getByText('$6k · 4p')).toBeInTheDocument();
  });

  it('shows at most 5 entries (top-5 slice)', () => {
    const storage = makeStorage();
    const entries = Array.from({ length: 7 }, (_, i) => ({
      runSeed: i + 1,
      score: (7 - i) * 1000,
      loot: 10000,
      heatAtGetaway: 1,
      win: true,
      crewSize: 3,
      finishedAt: i * 1000,
    }));
    storage.setItem(
      'the-job:leaderboard',
      JSON.stringify({ version: LEADERBOARD_VERSION, entries }),
    );
    renderSetup(storage);
    // Store sorts descending by score; slice(0,5) keeps rank 1-5 only
    expect(screen.getByText('$7k')).toBeInTheDocument();
    expect(screen.queryByText('$1k')).toBeNull();
  });
});
