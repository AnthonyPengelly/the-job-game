import { describe, it, expect, beforeEach } from 'vitest';
import { createGameStore } from './store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { RunEvent, PlayerId } from '@/engine';
import { SAVE_VERSION } from '@/content/schema/save';

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

function seedStore(storage: StorageLike, seed = 42) {
  const store = createGameStore({ cfg: testCfg, storage });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);
  return store;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('startRun', () => {
  it('clears staleSaveNotice left by a prior stale hydrate', () => {
    const storage = makeStorage();
    storage.setItem(
      'the-job:run-save',
      JSON.stringify({ version: 999, seed: 42, eventLog: [] }),
    );
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().hydrate();
    expect(store.getState().staleSaveNotice).toBe(true);

    store.getState().startRun([{ name: 'Alice' }], 1);
    expect(store.getState().staleSaveNotice).toBe(false);
  });

  it('advances to room phase and records a single START_RUN event', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 42);
    const { session, eventLog } = store.getState();
    expect(session.present.phase).toBe('room');
    expect(eventLog).toHaveLength(1);
    expect(eventLog[0]!.t).toBe('START_RUN');
  });

  it('writes through after startRun', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().startRun([{ name: 'Alice' }], 7);
    const raw = storage.getItem('the-job:run-save');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { version: number; seed: number; eventLog: RunEvent[] };
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.seed).toBe(7);
    expect(saved.eventLog).toHaveLength(1);
  });
});

describe('dispatch advances state and writes through', () => {
  it('CHOOSE_OPTION advances to minigame phase', () => {
    const storage = makeStorage();
    const store = seedStore(storage);
    const { session } = store.getState();
    const room = session.present.currentRoom;
    expect(room?.kind).toBe('obstacle');
    if (room?.kind !== 'obstacle') return;
    const opt = room.options[0]!;
    const player = session.present.crew[0]!;

    const event: RunEvent = { t: 'CHOOSE_OPTION', optionId: opt.id, committed: [player.id] };
    store.getState().dispatch(event);

    expect(store.getState().session.present.phase).toBe('minigame');
    expect(store.getState().eventLog).toHaveLength(2);
  });

  it('writes through after each dispatch', () => {
    const storage = makeStorage();
    const store = seedStore(storage);
    const { session } = store.getState();
    const room = session.present.currentRoom;
    if (room?.kind !== 'obstacle') throw new Error('expected obstacle room');
    const opt = room.options[0]!;
    const player = session.present.crew[0]!;

    store.getState().dispatch({ t: 'CHOOSE_OPTION', optionId: opt.id, committed: [player.id] });

    const raw = storage.getItem('the-job:run-save');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { version: number; seed: number; eventLog: RunEvent[] };
    expect(saved.eventLog).toHaveLength(2);
  });
});

describe('undo', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = makeStorage();
  });

  it('restores the state prior to the last dispatch', () => {
    const store = seedStore(storage);
    const afterStart = store.getState().session.present;
    const room = afterStart.currentRoom;
    if (room?.kind !== 'obstacle') throw new Error('expected obstacle room');
    const opt = room.options[0]!;
    const player = afterStart.crew[0]!;

    store.getState().dispatch({ t: 'CHOOSE_OPTION', optionId: opt.id, committed: [player.id] });
    expect(store.getState().session.present.phase).toBe('minigame');

    store.getState().undo();
    expect(store.getState().session.present).toEqual(afterStart);
  });

  it('shrinks eventLog by one after undo', () => {
    const store = seedStore(storage);
    const room = store.getState().session.present.currentRoom;
    if (room?.kind !== 'obstacle') throw new Error('expected obstacle room');
    const opt = room.options[0]!;
    const player = store.getState().session.present.crew[0]!;

    store.getState().dispatch({ t: 'CHOOSE_OPTION', optionId: opt.id, committed: [player.id] });
    expect(store.getState().eventLog).toHaveLength(2);

    store.getState().undo();
    expect(store.getState().eventLog).toHaveLength(1);
  });

  it('is a safe no-op when past stack is empty', () => {
    const store = createGameStore({ cfg: testCfg, storage });
    // undo with no history should not throw
    expect(() => store.getState().undo()).not.toThrow();
    expect(store.getState().eventLog).toHaveLength(0);
  });

  it('does not write a phantom save when there is nothing to undo', () => {
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().undo();
    // No save should have been written — storage must stay empty
    expect(storage.getItem('the-job:run-save')).toBeNull();
  });
});

describe('hydrate', () => {
  it('replays to a byte-identical present from storage', () => {
    const storage = makeStorage();
    const store1 = seedStore(storage);
    const room = store1.getState().session.present.currentRoom;
    if (room?.kind !== 'obstacle') throw new Error('expected obstacle room');
    const opt = room.options[0]!;
    const player = store1.getState().session.present.crew[0]!;

    store1.getState().dispatch({ t: 'CHOOSE_OPTION', optionId: opt.id, committed: [player.id] });
    store1.getState().dispatch({ t: 'RESOLVE_MINIGAME', outcome: 'clean' });
    const presentBefore = store1.getState().session.present;

    // New store with same storage and config
    const store2 = createGameStore({ cfg: testCfg, storage });
    store2.getState().hydrate();

    expect(store2.getState().session.present).toEqual(presentBefore);
    expect(store2.getState().hasResumableSave).toBe(true);
    expect(store2.getState().eventLog).toHaveLength(3);
  });

  it('absent save → clean start, no notice', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().hydrate();
    expect(store.getState().staleSaveNotice).toBe(false);
    expect(store.getState().hasResumableSave).toBe(false);
  });
});

describe('stale save', () => {
  it('stale version → clean start + notice flag + cleared storage', () => {
    const storage = makeStorage();
    storage.setItem(
      'the-job:run-save',
      JSON.stringify({ version: 999, seed: 42, eventLog: [] }),
    );
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().hydrate();

    expect(store.getState().staleSaveNotice).toBe(true);
    expect(store.getState().hasResumableSave).toBe(false);
    expect(storage.getItem('the-job:run-save')).toBeNull();
    // Starts clean (initial briefing state)
    expect(store.getState().session.present.phase).toBe('briefing');
  });

  it('corrupt save → clean start + notice flag + cleared storage', () => {
    const storage = makeStorage();
    storage.setItem('the-job:run-save', 'not-json-{{{');
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().hydrate();

    expect(store.getState().staleSaveNotice).toBe(true);
    expect(storage.getItem('the-job:run-save')).toBeNull();
  });
});

describe('goAgain', () => {
  it('clears save and resets to initial briefing state', () => {
    const storage = makeStorage();
    const store = seedStore(storage);
    expect(store.getState().session.present.phase).toBe('room');

    store.getState().goAgain();
    expect(store.getState().session.present.phase).toBe('briefing');
    expect(store.getState().eventLog).toHaveLength(0);
    expect(store.getState().hasResumableSave).toBe(false);
    expect(storage.getItem('the-job:run-save')).toBeNull();
  });
});

describe('undo write-through consistency', () => {
  it('write-through after undo matches eventLog', () => {
    const storage = makeStorage();
    const store = seedStore(storage);
    const room = store.getState().session.present.currentRoom;
    if (room?.kind !== 'obstacle') throw new Error('expected obstacle room');
    const opt = room.options[0]!;
    const player = store.getState().session.present.crew[0]!;

    store.getState().dispatch({ t: 'CHOOSE_OPTION', optionId: opt.id, committed: [player.id as PlayerId] });
    store.getState().undo();

    const raw = storage.getItem('the-job:run-save');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { eventLog: RunEvent[] };
    expect(saved.eventLog).toHaveLength(store.getState().eventLog.length);
  });
});
