import { describe, it, expect } from 'vitest';
import { createGameStore } from './store';
import { resolveBootPreset } from './StoreProvider';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { clonePreset, writePreset, readSettings, writeSettings } from '@/platform';
import type { UserPreset } from '@/content/schema/user-preset';
import { tuningSchema } from '@/content/schema';
import { SETTINGS_VERSION } from '@/content/schema/settings';
import tuningJson from '../../../presets/default/tuning.json';

// Parsed default tuning via Zod (needed to construct valid UserPresets).
const defaultTuning = tuningSchema.parse(tuningJson);

// ── In-memory storage stub ────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUserPreset(id: string, name: string, hMax = 20): UserPreset {
  return {
    id,
    name,
    baseId: 'default',
    tuning: { ...defaultTuning, heat: { ...defaultTuning.heat, hMax } },
  };
}

// ── applyPreset — valid preset ────────────────────────────────────────────────

describe('applyPreset — valid user preset', () => {
  it('swaps cfg with the new preset values', () => {
    const storage = makeStorage();
    // Write a user preset with a different hMax so we can detect the swap.
    const preset = makeUserPreset('my-preset', 'My Preset', 30);
    writePreset(preset, storage);

    const store = createGameStore({ cfg: testCfg, storage, activePresetId: 'default' });
    store.getState().applyPreset('my-preset');

    expect(store.getState().cfg.heat.hMax).toBe(30);
    expect(store.getState().applyPresetError).toBeNull();
  });

  it('updates activePresetId in state', () => {
    const storage = makeStorage();
    writePreset(makeUserPreset('p1', 'P1'), storage);

    const store = createGameStore({ cfg: testCfg, storage, activePresetId: 'default' });
    store.getState().applyPreset('p1');

    expect(store.getState().activePresetId).toBe('p1');
  });

  it('persists activePresetId to settings storage', () => {
    const storage = makeStorage();
    writePreset(makeUserPreset('p2', 'P2'), storage);

    const store = createGameStore({ cfg: testCfg, storage, activePresetId: 'default' });
    store.getState().applyPreset('p2');

    const settings = readSettings(storage);
    expect(settings.activePresetId).toBe('p2');
  });

  it('resets to a clean pre-run state (clears save, resets session and eventLog)', () => {
    const storage = makeStorage();
    writePreset(makeUserPreset('p3', 'P3'), storage);

    const store = createGameStore({ cfg: testCfg, storage });
    // Advance the store into a run so there is state to clear.
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 42);
    expect(store.getState().eventLog).toHaveLength(1);
    expect(storage.getItem('the-job:run-save')).not.toBeNull();

    store.getState().applyPreset('p3');

    expect(store.getState().eventLog).toHaveLength(0);
    expect(store.getState().runSeed).toBe(0);
    expect(store.getState().hasResumableSave).toBe(false);
    expect(store.getState().staleSaveNotice).toBe(false);
    expect(storage.getItem('the-job:run-save')).toBeNull();
  });

  it('clears applyPresetError on a successful swap', () => {
    const storage = makeStorage();
    writePreset(makeUserPreset('good', 'Good'), storage);

    // Pre-seed an error state
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().applyPreset('nonexistent');
    expect(store.getState().applyPresetError).not.toBeNull();

    // Now apply a valid preset — error should clear
    store.getState().applyPreset('good');
    expect(store.getState().applyPresetError).toBeNull();
  });

  it('applying "default" succeeds and records activePresetId as "default"', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().applyPreset('default');

    expect(store.getState().activePresetId).toBe('default');
    expect(store.getState().applyPresetError).toBeNull();
    expect(readSettings(storage).activePresetId).toBe('default');
  });
});

// ── applyPreset — invalid / missing id ───────────────────────────────────────

describe('applyPreset — invalid or missing id', () => {
  it('leaves cfg unchanged when the id is not found', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    const cfgBefore = store.getState().cfg;

    store.getState().applyPreset('does-not-exist');

    expect(store.getState().cfg).toBe(cfgBefore);
  });

  it('sets applyPresetError with a descriptive message for a missing id', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().applyPreset('unknown-id');

    expect(store.getState().applyPresetError).not.toBeNull();
    expect(store.getState().applyPresetError).toContain('unknown-id');
  });

  it('sets applyPresetError naming the invalid field for an out-of-range tuning value', () => {
    const storage = makeStorage();
    const clone = clonePreset('default', 'Bad Preset', storage);
    const bad: UserPreset = {
      ...clone,
      tuning: { ...clone.tuning, heat: { ...clone.tuning.heat, runAtFraction: 1.5 } },
    };
    writePreset(bad, storage);

    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().applyPreset(bad.id);

    expect(store.getState().applyPresetError).not.toBeNull();
    expect(store.getState().applyPresetError).toContain('runAtFraction');
  });

  it('does not update activePresetId on failure', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage, activePresetId: 'default' });
    store.getState().applyPreset('ghost-preset');

    expect(store.getState().activePresetId).toBe('default');
  });

  it('does not clear the in-progress save on failure', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().startRun([{ name: 'Alice' }], 1);
    const saveBeforeAttempt = storage.getItem('the-job:run-save');

    store.getState().applyPreset('nonexistent');

    expect(storage.getItem('the-job:run-save')).toBe(saveBeforeAttempt);
  });
});

// ── resolveBootPreset — boot-time preset selection ───────────────────────────

describe('resolveBootPreset — persisted activePresetId', () => {
  it('returns default config when no settings are stored', () => {
    const storage = makeStorage();
    const boot = resolveBootPreset(storage);
    expect(boot.activePresetId).toBe('default');
    expect(boot.presetFallbackNotice).toBe(false);
  });

  it('returns the persisted preset when it is valid', () => {
    const storage = makeStorage();
    const preset = makeUserPreset('my-boot', 'Boot Preset', 25);
    writePreset(preset, storage);
    const settings = readSettings(storage);
    writeSettings({ ...settings, activePresetId: 'my-boot' }, storage);

    const boot = resolveBootPreset(storage);
    expect(boot.activePresetId).toBe('my-boot');
    expect(boot.cfg.heat.hMax).toBe(25);
    expect(boot.presetFallbackNotice).toBe(false);
  });

  it('falls back to default and sets presetFallbackNotice when persisted id is unknown', () => {
    const storage = makeStorage();
    writeSettings(
      { version: SETTINGS_VERSION, diceMode: 'app', activePresetId: 'ghost-preset' },
      storage,
    );

    const boot = resolveBootPreset(storage);
    expect(boot.activePresetId).toBe('default');
    expect(boot.presetFallbackNotice).toBe(true);
  });

  it('falls back to default and sets presetFallbackNotice for a preset with invalid tuning', () => {
    const storage = makeStorage();
    const clone = clonePreset('default', 'Bad Boot', storage);
    const bad: UserPreset = {
      ...clone,
      tuning: { ...clone.tuning, heat: { ...clone.tuning.heat, runAtFraction: 2.0 } },
    };
    writePreset(bad, storage);
    writeSettings(
      { version: SETTINGS_VERSION, diceMode: 'app', activePresetId: bad.id },
      storage,
    );

    const boot = resolveBootPreset(storage);
    expect(boot.activePresetId).toBe('default');
    expect(boot.presetFallbackNotice).toBe(true);
  });
});

describe('resolveBootPreset — ?preset= URL param', () => {
  it('honours a valid ?preset= param over the persisted setting', () => {
    const storage = makeStorage();
    const preset = makeUserPreset('url-preset', 'URL Preset', 15);
    writePreset(preset, storage);
    // Persisted setting points to a different preset.
    writeSettings(
      { version: SETTINGS_VERSION, diceMode: 'app', activePresetId: 'default' },
      storage,
    );

    const boot = resolveBootPreset(storage, '?preset=url-preset');
    expect(boot.activePresetId).toBe('url-preset');
    expect(boot.cfg.heat.hMax).toBe(15);
    expect(boot.presetFallbackNotice).toBe(false);
  });

  it('falls back to default with notice when the ?preset= param names an unknown preset', () => {
    const storage = makeStorage();
    const boot = resolveBootPreset(storage, '?preset=does-not-exist');
    expect(boot.activePresetId).toBe('default');
    expect(boot.presetFallbackNotice).toBe(true);
  });

  it('resolves default when no param is present (empty search string)', () => {
    const storage = makeStorage();
    const boot = resolveBootPreset(storage, '');
    expect(boot.activePresetId).toBe('default');
    expect(boot.presetFallbackNotice).toBe(false);
  });
});

// ── createGameStore initialises from boot options ─────────────────────────────

describe('createGameStore — initial activePresetId and presetFallbackNotice', () => {
  it('defaults activePresetId to "default" when not supplied', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    expect(store.getState().activePresetId).toBe('default');
  });

  it('uses the supplied activePresetId', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage, activePresetId: 'my-id' });
    expect(store.getState().activePresetId).toBe('my-id');
  });

  it('defaults presetFallbackNotice to false', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    expect(store.getState().presetFallbackNotice).toBe(false);
  });

  it('surfaces presetFallbackNotice when set in options', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage, presetFallbackNotice: true });
    expect(store.getState().presetFallbackNotice).toBe(true);
  });
});
