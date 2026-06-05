// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore, useGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { RunPhase } from '@/engine';
import { PhaseRouter } from '@/console/screens';
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

/** Renders OverridePanel alongside a PhaseRouter so phase-jump tests can verify screen transitions. */
function PanelWithRouter() {
  const phase = useGameStore(s => s.session.present.phase);
  return (
    <>
      <OverridePanel />
      <PhaseRouter phase={phase} />
    </>
  );
}

function renderPanelWithRouter() {
  const store = makeStore();
  render(
    <StoreContext.Provider value={store}>
      <PanelWithRouter />
    </StoreContext.Provider>,
  );
  return store;
}

/** Open the collapsible body by clicking the toggle button. */
function openPanel(): void {
  fireEvent.click(screen.getByTestId('btn-override-toggle'));
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('OverridePanel — rendering', () => {
  it('renders the panel container', () => {
    renderPanel();
    expect(screen.getByTestId('override-panel')).toBeInTheDocument();
  });

  it('renders Undo Last button at all times (outside the collapsible)', () => {
    renderPanel();
    expect(screen.getByTestId('btn-undo-last')).toBeInTheDocument();
  });

  it('toggle button is present; body is hidden before first open', () => {
    renderPanel();
    expect(screen.getByTestId('btn-override-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('override-panel-body')).toBeNull();
  });

  it('opening the toggle reveals the panel body', () => {
    renderPanel();
    openPanel();
    expect(screen.getByTestId('override-panel-body')).toBeInTheDocument();
  });

  it('renders a per-player section for each crew member', () => {
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <OverridePanel />
      </StoreContext.Provider>,
    );
    openPanel();
    const crew = store.getState().session.present.crew;
    for (const player of crew) {
      expect(screen.getByTestId(`override-player-${player.id}`)).toBeInTheDocument();
    }
  });
});

// ── Heat overrides ────────────────────────────────────────────────────────────

describe('OverridePanel — Heat overrides', () => {
  it('Heat +1 dispatches OVERRIDE_ADJUST_HEAT and increases heat by 1', () => {
    const store = renderPanel();
    openPanel();
    const heatBefore = store.getState().session.present.heat;

    fireEvent.click(screen.getByTestId('btn-override-adjust-heat-plus'));

    expect(store.getState().session.present.heat).toBe(heatBefore + 1);
    expect(store.getState().eventLog.at(-1)?.t).toBe('OVERRIDE_ADJUST_HEAT');
  });

  it('Heat -1 dispatches OVERRIDE_ADJUST_HEAT and decreases heat by 1', () => {
    const store = renderPanel();
    // First set heat to 5 so we can decrease without clamping
    store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 5 });
    openPanel();

    fireEvent.click(screen.getByTestId('btn-override-adjust-heat-minus'));

    expect(store.getState().session.present.heat).toBe(4);
    expect(store.getState().eventLog.at(-1)?.t).toBe('OVERRIDE_ADJUST_HEAT');
  });

  it('Set Heat input dispatches OVERRIDE_SET_HEAT and updates heat', () => {
    const store = renderPanel();
    openPanel();

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
    openPanel();
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
    openPanel();
    const lootBefore = store.getState().session.present.loot;

    fireEvent.click(screen.getByTestId('btn-override-adjust-loot-plus'));

    expect(store.getState().session.present.loot).toBe(lootBefore + 1);
    expect(store.getState().eventLog.at(-1)?.t).toBe('OVERRIDE_ADJUST_LOOT');
  });

  it('Loot -1 dispatches OVERRIDE_ADJUST_LOOT and decreases loot', () => {
    const store = renderPanel();
    store.getState().dispatch({ t: 'OVERRIDE_SET_LOOT', value: 5 });
    openPanel();

    fireEvent.click(screen.getByTestId('btn-override-adjust-loot-minus'));

    expect(store.getState().session.present.loot).toBe(4);
  });

  it('Set Loot input dispatches OVERRIDE_SET_LOOT and updates loot', () => {
    const store = renderPanel();
    openPanel();

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

// ── Player stat overrides ─────────────────────────────────────────────────────

describe('OverridePanel — Player stat overrides', () => {
  it('stat +1 button dispatches OVERRIDE_ADJUST_STAT and increases the lane stat', () => {
    const store = renderPanel();
    openPanel();
    const player = store.getState().session.present.crew[0]!;
    const techBefore = player.stats.tech;

    fireEvent.click(screen.getByTestId(`btn-override-stat-plus-${player.id}-tech`));

    const techAfter = store.getState().session.present.crew[0]!.stats.tech;
    expect(techAfter).toBe(techBefore + 1);
    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('OVERRIDE_ADJUST_STAT');
  });

  it('stat -1 button dispatches OVERRIDE_ADJUST_STAT and decreases the lane stat', () => {
    const store = renderPanel();
    openPanel();
    const player = store.getState().session.present.crew[0]!;
    const techBefore = player.stats.tech;

    fireEvent.click(screen.getByTestId(`btn-override-stat-minus-${player.id}-tech`));

    const techAfter = store.getState().session.present.crew[0]!.stats.tech;
    expect(techAfter).toBe(techBefore - 1);
  });

  it('Set Stat input dispatches OVERRIDE_SET_STAT and sets the lane stat', () => {
    const store = renderPanel();
    openPanel();
    const player = store.getState().session.present.crew[0]!;

    fireEvent.change(screen.getByTestId(`override-stat-input-${player.id}-charm`), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByTestId(`btn-override-set-stat-${player.id}-charm`));

    const charmAfter = store.getState().session.present.crew[0]!.stats.charm;
    expect(charmAfter).toBe(5);
    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('OVERRIDE_SET_STAT');
    if (lastEvent?.t === 'OVERRIDE_SET_STAT') {
      expect(lastEvent.lane).toBe('charm');
      expect(lastEvent.value).toBe(5);
    }
  });
});

// ── Power-up overrides ────────────────────────────────────────────────────────

describe('OverridePanel — Power-up overrides', () => {
  it('Set power-up button dispatches OVERRIDE_SET_POWERUP held=true', () => {
    const store = renderPanel();
    openPanel();
    const player = store.getState().session.present.crew[0]!;
    expect(player.powerUps.stealth).toBeUndefined();

    fireEvent.click(screen.getByTestId(`btn-override-powerup-${player.id}-stealth`));

    const updatedPlayer = store.getState().session.present.crew[0]!;
    expect(updatedPlayer.powerUps.stealth).toBe(true);
    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('OVERRIDE_SET_POWERUP');
    if (lastEvent?.t === 'OVERRIDE_SET_POWERUP') {
      expect(lastEvent.held).toBe(true);
      expect(lastEvent.lane).toBe('stealth');
    }
  });

  it('toggling power-up again dispatches OVERRIDE_SET_POWERUP held=false (clear)', () => {
    const store = renderPanel();
    openPanel();
    const player = store.getState().session.present.crew[0]!;

    // Set it first
    fireEvent.click(screen.getByTestId(`btn-override-powerup-${player.id}-stealth`));
    expect(store.getState().session.present.crew[0]!.powerUps.stealth).toBe(true);

    // Clear it — button label has updated because store updated → re-render
    fireEvent.click(screen.getByTestId(`btn-override-powerup-${player.id}-stealth`));
    const after = store.getState().session.present.crew[0]!.powerUps.stealth;
    expect(after).toBeUndefined();

    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('OVERRIDE_SET_POWERUP');
    if (lastEvent?.t === 'OVERRIDE_SET_POWERUP') {
      expect(lastEvent.held).toBe(false);
    }
  });
});

// ── Resting overrides ─────────────────────────────────────────────────────────

describe('OverridePanel — Resting overrides', () => {
  it('Set Resting dispatches OVERRIDE_SET_RESTING with untilRoom', () => {
    const store = renderPanel();
    openPanel();
    const player = store.getState().session.present.crew[0]!;

    fireEvent.change(screen.getByTestId(`override-resting-input-${player.id}`), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByTestId(`btn-override-set-resting-${player.id}`));

    const updated = store.getState().session.present.crew[0]!;
    expect(updated.restingUntilRoom).toBe(3);
    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('OVERRIDE_SET_RESTING');
    if (lastEvent?.t === 'OVERRIDE_SET_RESTING') {
      expect(lastEvent.untilRoom).toBe(3);
    }
  });

  it('Clear Resting dispatches OVERRIDE_SET_RESTING without untilRoom', () => {
    const store = renderPanel();
    // First put a player to rest
    store.getState().dispatch({
      t: 'OVERRIDE_SET_RESTING',
      player: store.getState().session.present.crew[0]!.id,
      untilRoom: 5,
    });
    openPanel();
    const player = store.getState().session.present.crew[0]!;

    fireEvent.click(screen.getByTestId(`btn-override-clear-resting-${player.id}`));

    const updated = store.getState().session.present.crew[0]!;
    expect(updated.restingUntilRoom).toBeUndefined();
    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('OVERRIDE_SET_RESTING');
    if (lastEvent?.t === 'OVERRIDE_SET_RESTING') {
      expect(lastEvent.untilRoom).toBeUndefined();
    }
  });
});

// ── Room overrides ────────────────────────────────────────────────────────────

describe('OverridePanel — Room overrides', () => {
  it('Re-roll Room button dispatches OVERRIDE_REROLL_ROOM', () => {
    const store = renderPanel();
    openPanel();

    fireEvent.click(screen.getByTestId('btn-override-reroll-room'));

    expect(store.getState().eventLog.at(-1)?.t).toBe('OVERRIDE_REROLL_ROOM');
  });

  it('Skip Room button dispatches OVERRIDE_SKIP_ROOM and advances roomIndex', () => {
    const store = renderPanel();
    openPanel();
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
    openPanel();

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

  it('OVERRIDE_SET_PHASE jump moves the visible screen', () => {
    renderPanelWithRouter();
    openPanel();

    // Initially in briefing phase after START_RUN
    expect(screen.getByTestId('screen-briefing')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('override-phase-select'), {
      target: { value: 'offer' },
    });

    expect(screen.getByTestId('screen-offer')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-room')).toBeNull();
  });

  it('can jump to every RunPhase', () => {
    const ALL_RUN_PHASES: RunPhase[] = [
      'briefing',
      'room',
      'minigame',
      'offer',
      'getaway',
      'result',
    ];

    for (const phase of ALL_RUN_PHASES) {
      const store = makeStore();
      store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase });
      expect(store.getState().session.present.phase).toBe(phase);
      store.getState().undo();
      expect(store.getState().session.present.phase).toBe('briefing');
    }
  });
});

// ── Undo Last ─────────────────────────────────────────────────────────────────

describe('OverridePanel — Undo Last', () => {
  it('Undo Last button restores the immediately prior state', () => {
    const store = renderPanel();
    const heatBefore = store.getState().session.present.heat;
    openPanel();

    // Mutate heat, then undo
    fireEvent.click(screen.getByTestId('btn-override-adjust-heat-plus'));
    expect(store.getState().session.present.heat).toBe(heatBefore + 1);

    fireEvent.click(screen.getByTestId('btn-undo-last'));

    expect(store.getState().session.present.heat).toBe(heatBefore);
  });

  it('Undo Last on a phase jump restores the prior phase', () => {
    const store = renderPanel();
    openPanel();
    expect(store.getState().session.present.phase).toBe('briefing');

    fireEvent.change(screen.getByTestId('override-phase-select'), {
      target: { value: 'offer' },
    });
    expect(store.getState().session.present.phase).toBe('offer');

    fireEvent.click(screen.getByTestId('btn-undo-last'));
    expect(store.getState().session.present.phase).toBe('briefing');
  });

  it('Undo Last is safe when there is nothing to undo', () => {
    // Fresh store with no events yet — undo should not throw
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
    render(
      <StoreContext.Provider value={store}>
        <OverridePanel />
      </StoreContext.Provider>,
    );
    expect(() => fireEvent.click(screen.getByTestId('btn-undo-last'))).not.toThrow();
  });
});

// ── Surface reachable from every phase ────────────────────────────────────────

describe('OverridePanel — reachable from every phase', () => {
  it('override panel is present in the DOM in every RunPhase', () => {
    const ALL_RUN_PHASES: RunPhase[] = [
      'briefing',
      'room',
      'minigame',
      'offer',
      'getaway',
      'result',
    ];

    for (const phase of ALL_RUN_PHASES) {
      const store = makeStore();
      store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase });

      render(
        <StoreContext.Provider value={store}>
          <PanelWithRouter />
        </StoreContext.Provider>,
      );

      expect(screen.getByTestId('override-panel')).toBeInTheDocument();
      cleanup();
    }
  });
});
