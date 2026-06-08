// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { AudioEngine } from '@/platform';
import type { AudioHandle } from '@/console/audio';
import { AudioHandleContext } from '@/console/audio';
import { soundManifestSchema } from '@/content/schema';
import { ToolRail } from './ToolRail';
import soundJson from '../../../presets/default/content/sound.json';

afterEach(cleanup);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const manifest = soundManifestSchema.parse(soundJson);

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

function makeMockEngine(): AudioEngine {
  return {
    preload: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(),
    stop: vi.fn(),
    setChannelGain: vi.fn(),
    setMasterGain: vi.fn(),
    mute: vi.fn(),
    setAmbient: vi.fn(),
    scheduleBeep: vi.fn(),
    clock: {
      now: vi.fn().mockReturnValue(0),
      scheduleAt: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    },
    get loaded() { return false; },
  };
}

function makeStore(withRun = true) {
  const storage = makeStorage();
  const store = createGameStore({ cfg: testCfg, storage });
  if (withRun) {
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
  }
  return store;
}

function renderToolRail(
  opts: { withRun?: boolean; withAudio?: boolean; engine?: AudioEngine } = {},
) {
  const { withRun = true, withAudio = false, engine } = opts;
  const store = makeStore(withRun);
  const audioHandle: AudioHandle | null = withAudio && engine
    ? { engine, manifest }
    : null;

  const result = render(
    <StoreContext.Provider value={store}>
      <AudioHandleContext.Provider value={audioHandle}>
        <ToolRail />
      </AudioHandleContext.Provider>
    </StoreContext.Provider>,
  );
  return { store, ...result };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('ToolRail — rendering', () => {
  it('renders the tool rail container', () => {
    renderToolRail();
    expect(screen.getByTestId('tool-rail')).toBeInTheDocument();
  });

  it('renders the Undo button at all times', () => {
    renderToolRail();
    expect(screen.getByTestId('btn-undo-last')).toBeInTheDocument();
  });

  it('renders the Soundboard launcher', () => {
    renderToolRail();
    expect(screen.getByTestId('btn-tool-soundboard')).toBeInTheDocument();
  });

  it('renders the GM Overrides launcher when a run is active', () => {
    renderToolRail({ withRun: true });
    expect(screen.getByTestId('btn-tool-overrides')).toBeInTheDocument();
  });

  it('does not render the GM Overrides launcher with no crew', () => {
    renderToolRail({ withRun: false });
    expect(screen.queryByTestId('btn-tool-overrides')).toBeNull();
  });

  it('renders the Settings launcher', () => {
    renderToolRail();
    expect(screen.getByTestId('btn-tool-settings')).toBeInTheDocument();
  });

  it('renders the Gear launcher when a run is active', () => {
    renderToolRail({ withRun: true });
    expect(screen.getByTestId('btn-tool-gear')).toBeInTheDocument();
  });
});

// ── Undo ─────────────────────────────────────────────────────────────────────

describe('ToolRail — Undo', () => {
  it('Undo button calls undo in the store', () => {
    const { store } = renderToolRail();
    const heatBefore = store.getState().session.present.heat;

    // Mutate heat
    store.getState().dispatch({ t: 'OVERRIDE_ADJUST_HEAT', delta: 1 });
    expect(store.getState().session.present.heat).toBe(heatBefore + 1);

    // Click Undo
    fireEvent.click(screen.getByTestId('btn-undo-last'));
    expect(store.getState().session.present.heat).toBe(heatBefore);
  });

  it('Undo is safe when there is nothing to undo', () => {
    renderToolRail();
    expect(() => fireEvent.click(screen.getByTestId('btn-undo-last'))).not.toThrow();
  });
});

// ── Soundboard drawer ─────────────────────────────────────────────────────────

describe('ToolRail — Soundboard drawer', () => {
  it('opens the Soundboard drawer when the launcher is clicked', async () => {
    const engine = makeMockEngine();
    renderToolRail({ withRun: true, withAudio: true, engine });

    expect(screen.queryByTestId('drawer-soundboard')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-soundboard'));
    });
    expect(screen.getByTestId('drawer-soundboard')).toBeInTheDocument();
  });

  it('closes the Soundboard drawer when the scrim is clicked', async () => {
    const engine = makeMockEngine();
    renderToolRail({ withRun: true, withAudio: true, engine });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-soundboard'));
    });
    expect(screen.getByTestId('drawer-soundboard')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('cockpit-scrim'));
    });
    expect(screen.queryByTestId('drawer-soundboard')).toBeNull();
  });

  it('closes the Soundboard drawer when Esc is pressed', async () => {
    const engine = makeMockEngine();
    renderToolRail({ withRun: true, withAudio: true, engine });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-soundboard'));
    });
    expect(screen.getByTestId('drawer-soundboard')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByTestId('drawer-soundboard')).toBeNull();
  });

  it('toggling the Soundboard launcher a second time closes the drawer', async () => {
    const engine = makeMockEngine();
    renderToolRail({ withRun: true, withAudio: true, engine });

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-soundboard')); });
    expect(screen.getByTestId('drawer-soundboard')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-soundboard')); });
    expect(screen.queryByTestId('drawer-soundboard')).toBeNull();
  });
});

// ── GM Overrides drawer ───────────────────────────────────────────────────────

describe('ToolRail — GM Overrides drawer', () => {
  it('opens the Overrides drawer when the launcher is clicked', async () => {
    renderToolRail({ withRun: true });

    expect(screen.queryByTestId('drawer-overrides')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-overrides'));
    });
    expect(screen.getByTestId('drawer-overrides')).toBeInTheDocument();
  });

  it('Overrides drawer shows Heat section', async () => {
    renderToolRail({ withRun: true });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-overrides'));
    });
    expect(screen.getByTestId('override-section-heat')).toBeInTheDocument();
  });

  it('Overrides drawer shows Loot section', async () => {
    renderToolRail({ withRun: true });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-overrides'));
    });
    expect(screen.getByTestId('override-section-loot')).toBeInTheDocument();
  });

  it('Overrides drawer shows Room section', async () => {
    renderToolRail({ withRun: true });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-overrides'));
    });
    expect(screen.getByTestId('override-section-room')).toBeInTheDocument();
  });

  it('Overrides drawer shows Phase section', async () => {
    renderToolRail({ withRun: true });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-overrides'));
    });
    expect(screen.getByTestId('override-section-phase')).toBeInTheDocument();
  });

  it('does NOT show per-player overrides in the drawer', async () => {
    renderToolRail({ withRun: true });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-overrides'));
    });
    expect(screen.queryByTestId('override-player-player-0')).toBeNull();
  });

  it('closes the Overrides drawer when the scrim is clicked', async () => {
    renderToolRail({ withRun: true });

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-overrides')); });
    expect(screen.getByTestId('drawer-overrides')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByTestId('cockpit-scrim')); });
    expect(screen.queryByTestId('drawer-overrides')).toBeNull();
  });

  it('Heat +1 in the Overrides drawer updates the store', async () => {
    const { store } = renderToolRail({ withRun: true });
    const heatBefore = store.getState().session.present.heat;

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-overrides')); });
    fireEvent.click(screen.getByTestId('btn-override-adjust-heat-plus'));

    expect(store.getState().session.present.heat).toBe(heatBefore + 1);
  });
});

// ── Settings dialog ───────────────────────────────────────────────────────────

describe('ToolRail — Settings dialog', () => {
  it('opens the Settings dialog when the launcher is clicked', async () => {
    renderToolRail({ withRun: true });

    expect(screen.queryByTestId('settings-dialog')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-tool-settings'));
    });
    expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();
  });

  it('Settings dialog contains the dice-mode control', async () => {
    renderToolRail({ withRun: true });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-settings')); });
    expect(screen.getByTestId('dice-mode-select')).toBeInTheDocument();
  });

  it('Settings dialog closes on Esc', async () => {
    renderToolRail({ withRun: true });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-settings')); });
    expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();

    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByTestId('settings-dialog')).toBeNull();
  });

  it('Settings dialog closes on scrim click', async () => {
    renderToolRail({ withRun: true });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-settings')); });
    expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByTestId('cockpit-scrim')); });
    expect(screen.queryByTestId('settings-dialog')).toBeNull();
  });

  it('New Job button is shown in Settings dialog during a run', async () => {
    renderToolRail({ withRun: true });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-settings')); });
    expect(screen.getByTestId('btn-settings-new-job')).toBeInTheDocument();
  });

  it('New Job button is hidden in Settings dialog when no run is active', async () => {
    renderToolRail({ withRun: false });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-settings')); });
    expect(screen.queryByTestId('btn-settings-new-job')).toBeNull();
  });
});

// ── Gear badge ────────────────────────────────────────────────────────────────

describe('ToolRail — Gear badge', () => {
  it('gear badge is NOT shown when earnedGear is empty', () => {
    renderToolRail({ withRun: true });
    expect(screen.queryByTestId('tool-gear-badge')).toBeNull();
  });

  it('gear badge IS shown when earnedGear is non-empty', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);

    const audioHandle: AudioHandle | null = null;
    render(
      <StoreContext.Provider value={store}>
        <AudioHandleContext.Provider value={audioHandle}>
          <ToolRail />
        </AudioHandleContext.Provider>
      </StoreContext.Provider>,
    );

    // No gear → no badge initially
    expect(screen.queryByTestId('tool-gear-badge')).toBeNull();

    // Patch earnedGear directly via Zustand setState
    await act(async () => {
      store.setState(prev => ({
        session: {
          ...prev.session,
          present: {
            ...prev.session.present,
            earnedGear: ['some-gear-id' as import('@/engine').GearId],
          },
        },
      }));
    });

    // Badge should now be visible
    expect(screen.getByTestId('tool-gear-badge')).toBeInTheDocument();
    expect(screen.getByTestId('tool-gear-badge')).toHaveTextContent('1');
  });
});

// ── Confirm new job ───────────────────────────────────────────────────────────

describe('ToolRail — Confirm new job', () => {
  it('New Job opens the confirm dialog', async () => {
    renderToolRail({ withRun: true });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-settings')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-settings-new-job')); });
    expect(screen.getByTestId('confirm-new-job')).toBeInTheDocument();
  });

  it('Cancel on the confirm dialog keeps the run', async () => {
    const { store } = renderToolRail({ withRun: true });
    const crewBefore = store.getState().session.present.crew.length;

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-settings')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-settings-new-job')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-cancel')); });

    expect(store.getState().session.present.crew.length).toBe(crewBefore);
    expect(screen.queryByTestId('confirm-new-job')).toBeNull();
  });

  it('Confirm on the confirm dialog abandons the run (goAgain)', async () => {
    const { store } = renderToolRail({ withRun: true });
    expect(store.getState().session.present.crew.length).toBeGreaterThan(0);

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-settings')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-settings-new-job')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-confirm')); });

    // goAgain resets the crew to empty
    expect(store.getState().session.present.crew.length).toBe(0);
    expect(screen.queryByTestId('confirm-new-job')).toBeNull();
  });
});

// ── Gear dialog ───────────────────────────────────────────────────────────────

describe('ToolRail — Gear dialog', () => {
  async function makeStoreWithGear() {
    const storage = makeStorage();
    const gearCfg = {
      ...testCfg,
      gear: {
        'stat-tech-1': { id: 'stat-tech-1', kind: 'statBoost' as const, lane: 'tech' as const, magnitude: 1 },
      },
    };
    const store = createGameStore({ cfg: gearCfg, storage });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
    await act(async () => {
      store.setState(prev => ({
        session: {
          ...prev.session,
          present: {
            ...prev.session.present,
            earnedGear: ['stat-tech-1' as import('@/engine').GearId],
          },
        },
      }));
    });
    return store;
  }

  it('clicking Gear button opens the gear dialog', async () => {
    const store = await makeStoreWithGear();
    const audioHandle: AudioHandle | null = null;
    render(
      <StoreContext.Provider value={store}>
        <AudioHandleContext.Provider value={audioHandle}>
          <ToolRail />
        </AudioHandleContext.Provider>
      </StoreContext.Provider>,
    );

    expect(screen.queryByTestId('dialog-gear')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-gear')); });
    expect(screen.getByTestId('dialog-gear')).toBeInTheDocument();
  });

  it('gear dialog shows the earned gear items', async () => {
    const store = await makeStoreWithGear();
    const audioHandle: AudioHandle | null = null;
    render(
      <StoreContext.Provider value={store}>
        <AudioHandleContext.Provider value={audioHandle}>
          <ToolRail />
        </AudioHandleContext.Provider>
      </StoreContext.Provider>,
    );

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-gear')); });
    expect(screen.getByTestId('gear-assign-list')).toBeInTheDocument();
    expect(screen.getByTestId('gear-assign-row-stat-tech-1')).toBeInTheDocument();
  });

  it('gear dialog assigns gear when player is selected and Assign is clicked', async () => {
    const store = await makeStoreWithGear();
    const bob = store.getState().session.present.crew[1]!;
    const audioHandle: AudioHandle | null = null;
    render(
      <StoreContext.Provider value={store}>
        <AudioHandleContext.Provider value={audioHandle}>
          <ToolRail />
        </AudioHandleContext.Provider>
      </StoreContext.Provider>,
    );

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-gear')); });

    fireEvent.change(screen.getByTestId('gear-assign-player-stat-tech-1'), {
      target: { value: bob.id },
    });
    fireEvent.click(screen.getByTestId('gear-assign-btn-stat-tech-1'));

    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('ASSIGN_GEAR');
    if (lastEvent?.t === 'ASSIGN_GEAR') {
      expect(lastEvent.gear).toBe('stat-tech-1');
      expect(lastEvent.to).toBe(bob.id);
    }
  });

  it('gear dialog closes on Esc', async () => {
    const store = await makeStoreWithGear();
    const audioHandle: AudioHandle | null = null;
    render(
      <StoreContext.Provider value={store}>
        <AudioHandleContext.Provider value={audioHandle}>
          <ToolRail />
        </AudioHandleContext.Provider>
      </StoreContext.Provider>,
    );

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tool-gear')); });
    expect(screen.getByTestId('dialog-gear')).toBeInTheDocument();

    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByTestId('dialog-gear')).toBeNull();
  });
});
