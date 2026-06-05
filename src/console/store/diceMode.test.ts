import { describe, it, expect } from 'vitest';
import { createGameStore } from './store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { SETTINGS_VERSION } from '@/content/schema/settings';

// ── In-memory storage stub ────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

// ── Default value ─────────────────────────────────────────────────────────────

describe('diceMode default', () => {
  it('defaults to app on a fresh store with no settings in storage', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    expect(store.getState().diceMode).toBe('app');
  });
});

// ── setDiceMode write-through ─────────────────────────────────────────────────

describe('setDiceMode write-through', () => {
  it('updates diceMode in the store', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().setDiceMode('physical');
    expect(store.getState().diceMode).toBe('physical');
  });

  it('writes through to settings storage immediately', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().setDiceMode('physical');
    const raw = storage.getItem('the-job:settings');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { diceMode: string };
    expect(saved.diceMode).toBe('physical');
  });

  it('toggles back to app', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().setDiceMode('physical');
    store.getState().setDiceMode('app');
    expect(store.getState().diceMode).toBe('app');
    const raw = storage.getItem('the-job:settings');
    const saved = JSON.parse(raw!) as { diceMode: string };
    expect(saved.diceMode).toBe('app');
  });
});

// ── Reload / rehydration survival ────────────────────────────────────────────

describe('diceMode rehydration', () => {
  it('reads physical from storage when a new store is created (simulated reload)', () => {
    const storage = makeStorage();

    // First store: toggle to physical
    const store1 = createGameStore({ cfg: testCfg, storage });
    store1.getState().setDiceMode('physical');

    // Second store on same storage (simulated reload)
    const store2 = createGameStore({ cfg: testCfg, storage });
    expect(store2.getState().diceMode).toBe('physical');
  });

  it('hydrate() picks up the setting from storage', () => {
    const storage = makeStorage();
    // Pre-seed settings storage with physical
    storage.setItem(
      'the-job:settings',
      JSON.stringify({ version: SETTINGS_VERSION, diceMode: 'physical' }),
    );
    const store = createGameStore({ cfg: testCfg, storage });
    // diceMode already set at creation time
    expect(store.getState().diceMode).toBe('physical');

    // After a manual change, hydrate() re-reads from storage
    store.getState().setDiceMode('app');
    storage.setItem(
      'the-job:settings',
      JSON.stringify({ version: SETTINGS_VERSION, diceMode: 'physical' }),
    );
    store.getState().hydrate();
    expect(store.getState().diceMode).toBe('physical');
  });
});

// ── Separate key invariant ────────────────────────────────────────────────────

describe('separate key invariant', () => {
  it('clearing the run-save does not affect diceMode', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().setDiceMode('physical');

    // Simulate clearing run save
    storage.removeItem('the-job:run-save');

    // Create a fresh store on same storage (simulated reload after run clear)
    const store2 = createGameStore({ cfg: testCfg, storage });
    expect(store2.getState().diceMode).toBe('physical');
  });

  it('goAgain clears run-save but leaves settings intact', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().startRun([{ name: 'Alice' }], 42);
    store.getState().setDiceMode('physical');

    store.getState().goAgain();

    // Run save cleared
    expect(storage.getItem('the-job:run-save')).toBeNull();
    // Settings still present
    const raw = storage.getItem('the-job:settings');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { diceMode: string };
    expect(saved.diceMode).toBe('physical');
    // In-memory store diceMode still physical
    expect(store.getState().diceMode).toBe('physical');
  });
});
