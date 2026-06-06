import { describe, it, expect, vi } from 'vitest';
import { readSettings, writeSettings, clearSettings } from './settings';
import type { StorageLike } from './save';
import { SETTINGS_VERSION, DEFAULT_SETTINGS } from '@/content/schema/settings';

// ── In-memory storage stub ────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

const SETTINGS_KEY = 'the-job:settings';

// ── Default on fresh boot ─────────────────────────────────────────────────────

describe('readSettings — fresh boot', () => {
  it('returns default (diceMode=app) when no key is present', () => {
    const storage = makeStorage();
    const settings = readSettings(storage);
    expect(settings.diceMode).toBe('app');
    expect(settings.version).toBe(SETTINGS_VERSION);
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────

describe('writeSettings / readSettings round-trip', () => {
  it('persists diceMode=physical and reads it back', () => {
    const storage = makeStorage();
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'physical', activePresetId: 'default' }, storage);
    const result = readSettings(storage);
    expect(result.diceMode).toBe('physical');
    expect(result.activePresetId).toBe('default');
  });

  it('persists diceMode=app and reads it back', () => {
    const storage = makeStorage();
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'app', activePresetId: 'default' }, storage);
    const result = readSettings(storage);
    expect(result.diceMode).toBe('app');
  });

  it('round-trips a non-default activePresetId', () => {
    const storage = makeStorage();
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'app', activePresetId: 'user-preset-abc' }, storage);
    const result = readSettings(storage);
    expect(result.activePresetId).toBe('user-preset-abc');
  });
});

// ── Reload / rehydration survival ────────────────────────────────────────────

describe('reload / rehydration', () => {
  it('toggling to physical survives simulated reload (new readSettings call)', () => {
    const storage = makeStorage();
    // Initial default
    expect(readSettings(storage).diceMode).toBe('app');

    // Toggle and write through
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'physical', activePresetId: 'default' }, storage);

    // Simulate reload: fresh readSettings call on same storage
    const rehydrated = readSettings(storage);
    expect(rehydrated.diceMode).toBe('physical');
  });
});

// ── Separate key invariant ────────────────────────────────────────────────────

describe('separate key from run-save', () => {
  it('clearing the run-save key leaves settings intact', () => {
    const storage = makeStorage();
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'physical', activePresetId: 'default' }, storage);
    storage.setItem('the-job:run-save', JSON.stringify({ version: 1, seed: 42, eventLog: [] }));

    // Clear the run save
    storage.removeItem('the-job:run-save');

    // Settings should still be there
    const result = readSettings(storage);
    expect(result.diceMode).toBe('physical');
    expect(storage.getItem('the-job:run-save')).toBeNull();
  });

  it('clearSettings only removes the settings key', () => {
    const storage = makeStorage();
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'physical', activePresetId: 'default' }, storage);
    storage.setItem('the-job:run-save', JSON.stringify({ version: 1, seed: 42, eventLog: [] }));

    clearSettings(storage);

    // Settings key removed
    expect(storage.getItem(SETTINGS_KEY)).toBeNull();
    // Run save still present
    expect(storage.getItem('the-job:run-save')).not.toBeNull();
  });
});

// ── Invalid stored data → loud reset to default ───────────────────────────────

describe('invalid stored data → loud reset to default', () => {
  it('malformed JSON resets to default and warns', () => {
    const storage = makeStorage();
    storage.setItem(SETTINGS_KEY, '{ not valid json }}}');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = readSettings(storage);

    expect(result.diceMode).toBe('app');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('malformed JSON'));
    // Default written back
    const raw = storage.getItem(SETTINGS_KEY);
    expect(raw).not.toBeNull();
    const written = JSON.parse(raw!) as { diceMode: string };
    expect(written.diceMode).toBe('app');

    warnSpy.mockRestore();
  });

  it('schema-invalid data resets to default and warns', () => {
    const storage = makeStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, diceMode: 'laser-cannon' }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = readSettings(storage);

    expect(result.diceMode).toBe('app');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('version mismatch resets to default and warns', () => {
    const storage = makeStorage();
    storage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: SETTINGS_VERSION + 99, diceMode: 'physical' }),
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = readSettings(storage);

    expect(result.diceMode).toBe(DEFAULT_SETTINGS.diceMode);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('version mismatch'));

    warnSpy.mockRestore();
  });
});

// ── writeSettings error resilience ───────────────────────────────────────────

describe('writeSettings error resilience', () => {
  it('does not throw when storage.setItem throws QuotaExceededError', () => {
    const throwingStorage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
    };
    expect(() =>
      writeSettings({ version: SETTINGS_VERSION, diceMode: 'app', activePresetId: 'default' }, throwingStorage),
    ).not.toThrow();
  });
});

// ── v1 → v2 migration ────────────────────────────────────────────────────────

describe('v1 → v2 migration', () => {
  it('old v1 settings load without reset — diceMode is preserved', () => {
    const storage = makeStorage();
    // Simulate a v1 settings object (no activePresetId)
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, diceMode: 'physical' }));

    const result = readSettings(storage);

    expect(result.diceMode).toBe('physical');
    expect(result.activePresetId).toBe('default');
    expect(result.version).toBe(SETTINGS_VERSION);
  });

  it('migrated settings are written back with the new version', () => {
    const storage = makeStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, diceMode: 'app' }));

    readSettings(storage);

    const raw = storage.getItem(SETTINGS_KEY);
    expect(raw).not.toBeNull();
    const written = JSON.parse(raw!) as { version: number; activePresetId: string };
    expect(written.version).toBe(SETTINGS_VERSION);
    expect(written.activePresetId).toBe('default');
  });

  it('fresh default includes activePresetId', () => {
    const storage = makeStorage();
    const result = readSettings(storage);
    expect(result.activePresetId).toBe('default');
  });
});
