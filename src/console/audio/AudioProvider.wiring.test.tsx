// @vitest-environment jsdom
/**
 * Verifies the real AudioProvider wiring: useAmbientBed() must see the audio
 * handle from inside the providers it is a descendant of. This test would have
 * caught the original bug where useAmbientBed() was called in AudioProvider's
 * own body (context resolves to null there, so setAmbient was never reached).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike, AudioEngine } from '@/platform';

// ── Module mocks ──────────────────────────────────────────────────────────────
// vi.mock is hoisted; vi.hoisted values are available inside the factory.

const mockEngine = vi.hoisted<AudioEngine>(() => ({
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
}));

vi.mock('@/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform')>();
  return {
    ...actual,
    // Return empty object as manifest — useAmbientBed only needs engine.setAmbient.
    loadDefaultSoundManifest: vi.fn().mockReturnValue({}),
    createAudioEngine: vi.fn().mockReturnValue(mockEngine),
  };
});

// Import after mock is registered (hoisting handles ordering at runtime).
import { AudioProvider } from './AudioProvider';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

afterEach(cleanup);

// ── Provider wiring: AmbientBedWire is a descendant, not AudioProvider itself ─

describe('AudioProvider wiring — ambient bed reaches the engine', () => {
  it('calls setAmbient via the real AudioProvider when Heat changes', () => {
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });

    render(
      <StoreContext.Provider value={store}>
        <AudioProvider>{null}</AudioProvider>
      </StoreContext.Provider>,
    );

    act(() => {
      store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }]);
    });

    // heat=0 after run starts → setAmbient(0)
    expect(mockEngine.setAmbient).toHaveBeenLastCalledWith(0);

    act(() => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 10 });
    });

    // heat=10, hMax=20 → 0.5
    expect(mockEngine.setAmbient).toHaveBeenLastCalledWith(0.5);
  });

  it('setAmbient(1) when heat reaches hMax', () => {
    const store = createGameStore({ cfg: testCfg, storage: makeStorage() });

    render(
      <StoreContext.Provider value={store}>
        <AudioProvider>{null}</AudioProvider>
      </StoreContext.Provider>,
    );

    act(() => {
      store.getState().startRun([{ name: 'Alice' }]);
    });
    act(() => {
      store.getState().dispatch({ t: 'OVERRIDE_SET_HEAT', value: 20 });
    });

    expect(mockEngine.setAmbient).toHaveBeenLastCalledWith(1);
  });
});
