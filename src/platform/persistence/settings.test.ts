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
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'physical' }, storage);
    const result = readSettings(storage);
    expect(result.diceMode).toBe('physical');
  });

  it('persists diceMode=app and reads it back', () => {
    const storage = makeStorage();
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'app' }, storage);
    const result = readSettings(storage);
    expect(result.diceMode).toBe('app');
  });
});

// ── Reload / rehydration survival ────────────────────────────────────────────

describe('reload / rehydration', () => {
  it('toggling to physical survives simulated reload (new readSettings call)', () => {
    const storage = makeStorage();
    // Initial default
    expect(readSettings(storage).diceMode).toBe('app');

    // Toggle and write through
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'physical' }, storage);

    // Simulate reload: fresh readSettings call on same storage
    const rehydrated = readSettings(storage);
    expect(rehydrated.diceMode).toBe('physical');
  });
});

// ── Separate key invariant ────────────────────────────────────────────────────

describe('separate key from run-save', () => {
  it('clearing the run-save key leaves settings intact', () => {
    const storage = makeStorage();
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'physical' }, storage);
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
    writeSettings({ version: SETTINGS_VERSION, diceMode: 'physical' }, storage);
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
      writeSettings({ version: SETTINGS_VERSION, diceMode: 'app' }, throwingStorage),
    ).not.toThrow();
  });
});
