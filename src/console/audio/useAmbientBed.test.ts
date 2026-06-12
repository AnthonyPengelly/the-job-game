// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import React from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { StoreContext, createGameStore } from '@/console/store';
import type { GameStoreState } from '@/console/store';
import { AudioHandleContext } from '@/console/audio';
import type { AudioHandle } from '@/console/audio';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { AudioEngine } from '@/platform';
import { soundManifestSchema } from '@/content/schema';
import soundJson from '../../../presets/default/content/sound.json';
import { useAmbientBed } from './useAmbientBed';

const manifest = soundManifestSchema.parse(soundJson);

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    isCuePlaying: vi.fn().mockReturnValue(false),
    stopLoopsForPhase: vi.fn(),
    isCueAvailable: vi.fn().mockReturnValue(true),
    clock: {
      now: vi.fn().mockReturnValue(0),
      scheduleAt: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    },
    get loaded() { return false; },
  };
}

function makeWrapper(
  store: StoreApi<GameStoreState>,
  handle: AudioHandle | null,
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      StoreContext.Provider,
      { value: store },
      React.createElement(
        AudioHandleContext.Provider,
        { value: handle },
        children,
      ),
    );
  };
}

afterEach(cleanup);

// ── Ambient intensity tracks heat ─────────────────────────────────────────────

describe('useAmbientBed — intensity tracks Heat', () => {
  it('calls setAmbient(0) initially when no run is active (crew empty)', () => {
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
    const engine = makeMockEngine();
    const handle: AudioHandle = { engine, manifest };

    renderHook(() => useAmbientBed(), { wrapper: makeWrapper(store, handle) });

    // crew.length === 0 before startRun → intensity 0
    expect(engine.setAmbient).toHaveBeenLastCalledWith(0);
  });

  it('calls setAmbient(~0) at heat 0 after run starts', () => {
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
    const engine = makeMockEngine();
    const handle: AudioHandle = { engine, manifest };

    renderHook(() => useAmbientBed(), { wrapper: makeWrapper(store, handle) });

    act(() => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }]);
    });

    expect(engine.setAmbient).toHaveBeenLastCalledWith(0); // 0/20 = 0
  });

  it('intensity rises as heat increases toward hMax', () => {
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
    const engine = makeMockEngine();
    const handle: AudioHandle = { engine, manifest };

    renderHook(() => useAmbientBed(), { wrapper: makeWrapper(store, handle) });

    act(() => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }]);
    });

    // heat=10 → 10/20 = 0.5
    act(() => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 10 });
    });
    expect(engine.setAmbient).toHaveBeenLastCalledWith(0.5);

    // heat=20 (hMax) → 1
    act(() => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 20 });
    });
    expect(engine.setAmbient).toHaveBeenLastCalledWith(1);
  });

  it('UNDO_LAST lowers intensity back down (no dead-end)', () => {
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
    const engine = makeMockEngine();
    const handle: AudioHandle = { engine, manifest };

    renderHook(() => useAmbientBed(), { wrapper: makeWrapper(store, handle) });

    act(() => {
      store.getState().startRun([{ name: 'Alice' }]);
    });
    act(() => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 10 });
    });
    act(() => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 20 });
    });
    // intensity is ~1 at this point

    // Undo the last override → heat returns to 10 → intensity 0.5
    act(() => {
      store.getState().undo();
    });
    expect(engine.setAmbient).toHaveBeenLastCalledWith(0.5);
  });

  it('OVERRIDE_ADJUST_HEAT raises intensity proportionally', () => {
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
    const engine = makeMockEngine();
    const handle: AudioHandle = { engine, manifest };

    renderHook(() => useAmbientBed(), { wrapper: makeWrapper(store, handle) });

    act(() => {
      store.getState().startRun([{ name: 'Alice' }]);
    });

    act(() => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 5 });
    });
    expect(engine.setAmbient).toHaveBeenLastCalledWith(0.25); // 5/20

    act(() => {
      store.getState().dispatch({ t: 'OVERRIDE_ADJUST_HEAT', delta: 5 });
    });
    expect(engine.setAmbient).toHaveBeenLastCalledWith(0.5); // 10/20
  });

  it('intensity is clamped to [0, 1] even if heat exceeds hMax', () => {
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });
    const engine = makeMockEngine();
    const handle: AudioHandle = { engine, manifest };

    renderHook(() => useAmbientBed(), { wrapper: makeWrapper(store, handle) });

    act(() => {
      store.getState().startRun([{ name: 'Alice' }]);
    });
    act(() => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 30 }); // above hMax=20
    });
    expect(engine.setAmbient).toHaveBeenLastCalledWith(1);
  });
});

// ── No-op without audio handle ────────────────────────────────────────────────

describe('useAmbientBed — null handle', () => {
  it('does not throw when AudioHandleContext is null', () => {
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });

    expect(() => {
      renderHook(() => useAmbientBed(), { wrapper: makeWrapper(store, null) });
      act(() => {
        store.getState().startRun([{ name: 'Alice' }]);
      });
      act(() => {
        store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 10 });
      });
    }).not.toThrow();
  });
});
