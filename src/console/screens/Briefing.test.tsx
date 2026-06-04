// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext } from '@/console/store';
import { createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { Briefing } from './Briefing';

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

/** Labels mirrored from Briefing.tsx — used to assert rendered text. */
const MANSION_LABELS: Record<string, string> = {
  villa: 'A lavish villa on the coast',
  estate: 'A sprawling country estate',
  penthouse: 'A sky-high penthouse suite',
};

function renderBriefing(seed = 1) {
  const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);
  store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase: 'briefing' });
  render(
    <StoreContext.Provider value={store}>
      <Briefing />
    </StoreContext.Provider>,
  );
  return store;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Briefing screen', () => {
  it('renders the mansion-dressing label matching the active mansion type', () => {
    const store = renderBriefing(1);
    const mansionType = store.getState().session.present.mansion.type;
    const expected = MANSION_LABELS[mansionType];
    expect(expected).toBeDefined();
    expect(screen.getByTestId('mansion-dressing')).toHaveTextContent(expected!);
  });

  it('each mansion type maps to a non-empty label string', () => {
    // Collect the mansion types produced by a spread of seeds.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
      store.getState().startRun([{ name: 'A' }, { name: 'B' }], seed);
      seen.add(store.getState().session.present.mansion.type);
    }
    for (const type of seen) {
      expect(MANSION_LABELS[type]).toBeTruthy();
    }
  });

  it('clicking Begin transitions the phase to room', () => {
    const store = renderBriefing(1);
    fireEvent.click(screen.getByTestId('btn-begin'));
    expect(store.getState().session.present.phase).toBe('room');
  });
});
