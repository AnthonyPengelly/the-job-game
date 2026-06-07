// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { OverridePanel } from './OverridePanel';

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

function makeStore() {
  const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
  return store;
}

function renderPanel() {
  const store = makeStore();
  render(
    <StoreContext.Provider value={store}>
      <OverridePanel />
    </StoreContext.Provider>,
  );
  return store;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('OverridePanel — rendering', () => {
  it('renders the panel container', () => {
    renderPanel();
    expect(screen.getByTestId('override-panel')).toBeInTheDocument();
  });

  it('renders Heat section', () => {
    renderPanel();
    expect(screen.getByTestId('override-section-heat')).toBeInTheDocument();
  });

  it('renders Loot section', () => {
    renderPanel();
    expect(screen.getByTestId('override-section-loot')).toBeInTheDocument();
  });

  it('renders Room section', () => {
    renderPanel();
    expect(screen.getByTestId('override-section-room')).toBeInTheDocument();
  });

  it('renders Phase section', () => {
    renderPanel();
    expect(screen.getByTestId('override-section-phase')).toBeInTheDocument();
  });

  it('does not render per-player sections (relocated to CrewDetailPopover)', () => {
    renderPanel();
    expect(screen.queryByTestId('override-player-player-0')).toBeNull();
  });
});

// ── Heat overrides ────────────────────────────────────────────────────────────

describe('OverridePanel — Heat overrides', () => {
  it('Heat +1 dispatches OVERRIDE_ADJUST_HEAT and increases heat by 1', () => {
    const store = renderPanel();
    const heatBefore = store.getState().session.present.heat;

    fireEvent.click(screen.getByTestId('btn-override-adjust-heat-plus'));

    expect(store.getState().session.present.heat).toBe(heatBefore + 1);
    expect(store.getState().eventLog.at(-1)?.t).toBe('OVERRIDE_ADJUST_HEAT');
  });

  it('Heat -1 dispatches OVERRIDE_ADJUST_HEAT and decreases heat by 1', () => {
    const store = renderPanel();
    store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 5 });

    fireEvent.click(screen.getByTestId('btn-override-adjust-heat-minus'));

    expect(store.getState().session.present.heat).toBe(4);
    expect(store.getState().eventLog.at(-1)?.t).toBe('OVERRIDE_ADJUST_HEAT');
  });

  it('Set Heat input dispatches OVERRIDE_SET_HEAT and updates heat', () => {
    const store = renderPanel();

    fireEvent.change(screen.getByTestId('override-heat-input'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('btn-override-set-heat'));

    expect(store.getState().session.present.heat).toBe(10);
    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('OVERRIDE_SET_HEAT');
    if (lastEvent?.t === 'OVERRIDE_SET_HEAT') {
      expect(lastEvent.value).toBe(10);
    }
  });

  it('engine clamps heat at hMax when set above hMax', () => {
    const store = renderPanel();
    const hMax = testCfg.heat.hMax;

    fireEvent.change(screen.getByTestId('override-heat-input'), {
      target: { value: String(hMax + 5) },
    });
    fireEvent.click(screen.getByTestId('btn-override-set-heat'));

    expect(store.getState().session.present.heat).toBe(hMax);
  });
});

// ── Loot overrides ────────────────────────────────────────────────────────────

describe('OverridePanel — Loot overrides', () => {
  it('Loot +1 dispatches OVERRIDE_ADJUST_LOOT and increases loot', () => {
    const store = renderPanel();
    const lootBefore = store.getState().session.present.loot;

    fireEvent.click(screen.getByTestId('btn-override-adjust-loot-plus'));

    expect(store.getState().session.present.loot).toBe(lootBefore + 1);
    expect(store.getState().eventLog.at(-1)?.t).toBe('OVERRIDE_ADJUST_LOOT');
  });

  it('Loot -1 dispatches OVERRIDE_ADJUST_LOOT and decreases loot', () => {
    const store = renderPanel();
    store.getState().dispatch({ t: 'OVERRIDE_SET_LOOT', value: 5 });

    fireEvent.click(screen.getByTestId('btn-override-adjust-loot-minus'));

    expect(store.getState().session.present.loot).toBe(4);
  });

  it('Set Loot input dispatches OVERRIDE_SET_LOOT and updates loot', () => {
    const store = renderPanel();

    fireEvent.change(screen.getByTestId('override-loot-input'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('btn-override-set-loot'));

    expect(store.getState().session.present.loot).toBe(7);
    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('OVERRIDE_SET_LOOT');
    if (lastEvent?.t === 'OVERRIDE_SET_LOOT') {
      expect(lastEvent.value).toBe(7);
    }
  });
});

// ── Room overrides ────────────────────────────────────────────────────────────

describe('OverridePanel — Room overrides', () => {
  it('Re-roll Room button dispatches OVERRIDE_REROLL_ROOM', () => {
    const store = renderPanel();

    fireEvent.click(screen.getByTestId('btn-override-reroll-room'));

    expect(store.getState().eventLog.at(-1)?.t).toBe('OVERRIDE_REROLL_ROOM');
  });

  it('Skip Room button dispatches OVERRIDE_SKIP_ROOM and advances roomIndex', () => {
    const store = renderPanel();
    const roomIndexBefore = store.getState().session.present.roomIndex;

    fireEvent.click(screen.getByTestId('btn-override-skip-room'));

    expect(store.getState().eventLog.at(-1)?.t).toBe('OVERRIDE_SKIP_ROOM');
    expect(store.getState().session.present.roomIndex).toBe(roomIndexBefore + 1);
  });
});

// ── Phase-jump override ───────────────────────────────────────────────────────

describe('OverridePanel — Phase jump', () => {
  it('selecting a phase dispatches OVERRIDE_SET_PHASE', () => {
    const store = renderPanel();

    fireEvent.change(screen.getByTestId('override-phase-select'), {
      target: { value: 'offer' },
    });

    expect(store.getState().session.present.phase).toBe('offer');
    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('OVERRIDE_SET_PHASE');
    if (lastEvent?.t === 'OVERRIDE_SET_PHASE') {
      expect(lastEvent.phase).toBe('offer');
    }
  });
});
