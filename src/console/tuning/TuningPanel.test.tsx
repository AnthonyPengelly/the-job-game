// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { StoreContext } from '@/console/store';
import { createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { clonePreset, readSettings } from '@/platform';
import { tuningSchema } from '@/content/schema';
import tuningJson from '../../../presets/default/tuning.json';
import { TuningPanel } from './TuningPanel';

// ── useMonteCarlo mock ─────────────────────────────────────────────────────────
// Inline factory avoids TDZ issues with Vitest's vi.mock hoisting.
// Returns a deterministic win rate based on hMax so slider changes are observable.
vi.mock('./useMonteCarlo', () => ({
  useMonteCarlo: (cfg: { heat: { hMax: number } }) => ({
    result: {
      histogram: [{ obstacles: 4, count: 100 }],
      winRate: cfg.heat.hMax > 20 ? 0.4 : 0.7,
      medianObstacles: 4,
      pRoomsOver10: 0.02,
      pObstTight: 0.85,
      meanLoot: 8.0,
      meanScore: 300.0,
    },
    isRunning: false,
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

const defaultTuning = tuningSchema.parse(tuningJson);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

// ── Open / close ──────────────────────────────────────────────────────────────

describe('TuningPanel — toggle', () => {
  it('starts closed and shows a toggle button', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('btn-tuning-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('tuning-panel-body')).toBeNull();
  });

  it('opens when toggle is clicked', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    expect(screen.getByTestId('tuning-panel-body')).toBeInTheDocument();
  });

  it('closes when toggle is clicked again', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    expect(screen.queryByTestId('tuning-panel-body')).toBeNull();
  });
});

// ── Distributions update live (slider→cfg binding) ────────────────────────────

describe('TuningPanel — distributions update live', () => {
  it('shows distributions once the panel is open', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    // The mock returns winRate=0.7 for default hMax=20
    expect(screen.getByTestId('win-rate-label')).toHaveTextContent('70%');
  });

  it('changing hMax updates the distributions via new cfg', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    // Initially hMax=20 → winRate=70%
    expect(screen.getByTestId('win-rate-label')).toHaveTextContent('70%');
    // Change hMax to 30 → mock returns winRate=40%
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-heat-hMax'), { target: { value: '30' } });
    });
    expect(screen.getByTestId('win-rate-label')).toHaveTextContent('40%');
  });
});

// ── Invalid edit → validation error ───────────────────────────────────────────

describe('TuningPanel — invalid edit', () => {
  it('shows an error message when runAtFraction is out of range', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-heat-runAtFraction'), {
        target: { value: '1.5' },
      });
    });
    const errorEl = screen.getByTestId('tuning-validation-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl.textContent).toContain('runAtFraction');
  });

  it('Select / Play button is disabled when tuning is invalid', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-heat-runAtFraction'), {
        target: { value: '1.5' },
      });
    });
    expect(screen.getByTestId('btn-tuning-select')).toBeDisabled();
  });

  it('Save button is disabled when tuning is invalid', async () => {
    const storage = makeStorage();
    // Use a user preset so Save button is visible
    const clone = clonePreset('default', 'Test Preset', storage);
    const store = createGameStore({ cfg: testCfg, storage, activePresetId: clone.id });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-heat-runAtFraction'), {
        target: { value: '1.5' },
      });
    });
    expect(screen.getByTestId('btn-tuning-save')).toBeDisabled();
  });

  it('error clears after correcting the value', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-heat-runAtFraction'), {
        target: { value: '1.5' },
      });
    });
    expect(screen.getByTestId('tuning-validation-error')).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-heat-runAtFraction'), {
        target: { value: '0.55' },
      });
    });
    expect(screen.queryByTestId('tuning-validation-error')).toBeNull();
  });
});

// ── Save → Select → cfg-swap chain ────────────────────────────────────────────

describe('TuningPanel — save and select chain', () => {
  it('clone + select swaps cfg via applyPreset', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );

    // Open panel
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });

    // Change hMax to 30
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-heat-hMax'), { target: { value: '30' } });
    });

    // Open clone form
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-clone-show')); });

    // Enter name
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-clone-name'), {
        target: { value: 'Hot Preset' },
      });
    });

    // Confirm clone
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-clone-confirm')); });

    // Select the cloned preset to play
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-select')); });

    // Store's cfg should now have hMax=30
    expect(store.getState().cfg.heat.hMax).toBe(30);
  });

  it('save + select persists tuning and swaps cfg', async () => {
    const storage = makeStorage();
    // Start with a user preset so Save is available
    const clone = clonePreset('default', 'Base Preset', storage);
    const store = createGameStore({ cfg: testCfg, storage, activePresetId: clone.id });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });

    // Change hMax to 40
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-heat-hMax'), { target: { value: '40' } });
    });

    // Save working copy
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-save')); });
    expect(screen.getByTestId('tuning-save-message')).toHaveTextContent('Saved');

    // Select to play
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-select')); });

    expect(store.getState().cfg.heat.hMax).toBe(40);
    expect(store.getState().activePresetId).toBe(clone.id);
  });

  it('applyPreset activePresetId is persisted to settings after select', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });

    // Clone default and select it
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-clone-show')); });
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-clone-name'), { target: { value: 'Persist Test' } });
    });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-clone-confirm')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-select')); });

    // The settings in storage should carry the new activePresetId
    const settings = readSettings(storage);
    expect(settings.activePresetId).not.toBe('default');
  });
});

// ── Reset ─────────────────────────────────────────────────────────────────────

describe('TuningPanel — reset', () => {
  it('Reset button restores the working copy to the stored preset values', async () => {
    const storage = makeStorage();
    const clone = clonePreset('default', 'Reset Test', storage);
    const store = createGameStore({ cfg: testCfg, storage, activePresetId: clone.id });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );

    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });

    // Change hMax to 99 (out of range for the distribution mock → 40% win)
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-heat-hMax'), { target: { value: '99' } });
    });
    expect(screen.getByTestId('win-rate-label')).toHaveTextContent('40%');

    // Reset
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-reset')); });

    // Default hMax=20 → mock returns 70%
    expect(screen.getByTestId('win-rate-label')).toHaveTextContent('70%');
  });
});

// ── Clone form ────────────────────────────────────────────────────────────────

describe('TuningPanel — clone form', () => {
  it('Clone button is disabled when name is empty', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-clone-show')); });
    expect(screen.getByTestId('btn-tuning-clone-confirm')).toBeDisabled();
  });

  it('Cancel hides the clone form', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-clone-show')); });
    expect(screen.getByTestId('tuning-clone-form')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-clone-cancel')); });
    expect(screen.queryByTestId('tuning-clone-form')).toBeNull();
  });

  it('cloning creates a new preset in the selector', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-clone-show')); });
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-clone-name'), {
        target: { value: 'New Custom Preset' },
      });
    });
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-clone-confirm')); });

    const select = screen.getByTestId('tuning-preset-select') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.text);
    expect(options.some(t => t.includes('New Custom Preset'))).toBe(true);
  });
});

// ── Default preset is read-only ───────────────────────────────────────────────

describe('TuningPanel — default preset is read-only', () => {
  it('does not show the Save button when editing the default preset', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage, activePresetId: 'default' });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    expect(screen.queryByTestId('btn-tuning-save')).toBeNull();
  });
});

// ── GM-only placement ─────────────────────────────────────────────────────────

describe('TuningPanel — GM-only', () => {
  it('TuningPanel is not imported by player-view', async () => {
    // Player-view index must not reference TuningPanel to guarantee no leakage.
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const pvIndex = readFileSync(
      resolve(process.cwd(), 'src/player-view/index.ts'),
      'utf8',
    );
    expect(pvIndex).not.toContain('TuningPanel');
  });
});

// ── No-op for default tuning round-trip ──────────────────────────────────────

describe('TuningPanel — field range', () => {
  it('renders field inputs for Heat and Getaway groups', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    expect(screen.getByTestId('input-heat-hMax')).toBeInTheDocument();
    expect(screen.getByTestId('input-heat-runAtFraction')).toBeInTheDocument();
    expect(screen.getByTestId('input-getaway-exponent')).toBeInTheDocument();
    expect(screen.getByTestId('input-scoring-bustMultiplier')).toBeInTheDocument();
  });

  it('field inputs show the correct default values', async () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    render(
      <StoreContext.Provider value={store}>
        <TuningPanel storage={storage} />
      </StoreContext.Provider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('btn-tuning-toggle')); });
    const hMaxInput = screen.getByTestId('input-heat-hMax') as HTMLInputElement;
    expect(Number(hMaxInput.value)).toBe(defaultTuning.heat.hMax);
  });
});
