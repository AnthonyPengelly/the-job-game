import { describe, it, expect, beforeEach } from 'vitest';
import { writeSave, readSave, clearSave } from './save';
import type { StorageLike } from './save';
import { SAVE_VERSION } from '@/content/schema/save';
import type { SaveEnvelope } from '@/content/schema/save';
import type { PlayerId, QuirkId, GearId } from '@/engine/types';

// ── In-memory Storage stub ────────────────────────────────────────────────────

function makeMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_ENVELOPE: SaveEnvelope = {
  version: SAVE_VERSION,
  seed: 1312,
  eventLog: [
    { t: 'START_RUN', crew: [{ name: 'Alex' }, { name: 'Blair' }], seed: 1312 },
    { t: 'CHOOSE_OPTION', optionId: 'opt-a', committed: ['player-0' as PlayerId] },
    { t: 'RESOLVE_MINIGAME', outcome: 'clean' },
    { t: 'OVERRIDE_SET_HEAT', value: 8 },
    { t: 'PUSH_ON' },
    { t: 'CHOOSE_SCENARIO', choiceId: 'choice-b' },
    { t: 'CALL_GETAWAY' },
    { t: 'RESOLVE_GETAWAY', win: true },
  ],
};

// ── round-trip ────────────────────────────────────────────────────────────────

describe('readSave / writeSave round-trip', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = makeMemoryStorage();
  });

  it('returns absent when no save exists', () => {
    const result = readSave(storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('absent');
    }
  });

  it('round-trips a valid envelope through write → read', () => {
    writeSave(VALID_ENVELOPE, storage);
    const result = readSave(storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.version).toBe(SAVE_VERSION);
      expect(result.save.seed).toBe(1312);
      expect(result.save.eventLog).toHaveLength(VALID_ENVELOPE.eventLog.length);
      expect(result.save.eventLog[0]).toMatchObject({ t: 'START_RUN' });
      expect(result.save.eventLog[3]).toMatchObject({ t: 'OVERRIDE_SET_HEAT', value: 8 });
      expect(result.save.eventLog[7]).toMatchObject({ t: 'RESOLVE_GETAWAY', win: true });
    }
  });

  it('clearSave removes the key so readSave returns absent', () => {
    writeSave(VALID_ENVELOPE, storage);
    expect(readSave(storage).ok).toBe(true);
    clearSave(storage);
    const result = readSave(storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('absent');
    }
  });
});

// ── writeSave error resilience ────────────────────────────────────────────────

describe('writeSave error resilience', () => {
  it('does not throw when storage.setItem throws QuotaExceededError', () => {
    const throwingStorage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
    };
    expect(() => writeSave(VALID_ENVELOPE, throwingStorage)).not.toThrow();
  });

  it('does not throw when storage.setItem throws a SecurityError', () => {
    const throwingStorage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new DOMException('SecurityError', 'SecurityError'); },
      removeItem: () => {},
    };
    expect(() => writeSave(VALID_ENVELOPE, throwingStorage)).not.toThrow();
  });
});

// ── version mismatch ──────────────────────────────────────────────────────────

describe('readSave version mismatch → stale', () => {
  it('returns stale when the stored version does not match SAVE_VERSION', () => {
    const storage = makeMemoryStorage();
    const staleEnvelope = { ...VALID_ENVELOPE, version: SAVE_VERSION + 99 };
    storage.setItem('the-job:run-save', JSON.stringify(staleEnvelope));
    const result = readSave(storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('stale');
    }
  });

  it('returns stale (not corrupt) for a future-version save with a diverged eventLog schema', () => {
    const storage = makeMemoryStorage();
    storage.setItem('the-job:run-save', JSON.stringify({
      version: SAVE_VERSION + 1,
      seed: 0,
      eventLog: [{ t: 'FUTURE_EVENT_TYPE', unknownField: true }],
    }));
    const result = readSave(storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('stale');
    }
  });
});

// ── malformed data ────────────────────────────────────────────────────────────

describe('readSave malformed data → corrupt', () => {
  it('returns corrupt for invalid JSON', () => {
    const storage = makeMemoryStorage();
    storage.setItem('the-job:run-save', '{ not valid json }');
    const result = readSave(storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('corrupt');
    }
  });

  it('returns corrupt for valid JSON that fails the schema', () => {
    const storage = makeMemoryStorage();
    storage.setItem('the-job:run-save', JSON.stringify({ version: 1, seed: 'not-a-number', eventLog: [] }));
    const result = readSave(storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('corrupt');
    }
  });

  it('returns corrupt for an event log containing an unknown event t', () => {
    const storage = makeMemoryStorage();
    const badEnvelope = {
      version: SAVE_VERSION,
      seed: 0,
      eventLog: [{ t: 'TOTALLY_FAKE_EVENT', data: 42 }],
    };
    storage.setItem('the-job:run-save', JSON.stringify(badEnvelope));
    const result = readSave(storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('corrupt');
    }
  });

  it('returns corrupt for stored null', () => {
    const storage = makeMemoryStorage();
    storage.setItem('the-job:run-save', 'null');
    const result = readSave(storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('corrupt');
    }
  });
});

// ── SELL_GEAR persistence round-trip ─────────────────────────────────────────

describe('SELL_GEAR round-trip', () => {
  it('survives write → read when the event log contains SELL_GEAR', () => {
    const storage = makeMemoryStorage();
    const envelope: SaveEnvelope = {
      version: SAVE_VERSION,
      seed: 42,
      eventLog: [
        { t: 'START_RUN', crew: [{ name: 'Alex' }], seed: 42 },
        { t: 'ASSIGN_GEAR', gear: 'lockpick-set' as GearId, to: 'player-0' as PlayerId, earnedGearIndex: 0 },
        { t: 'SELL_GEAR', index: 1 },
        { t: 'PUSH_ON' },
      ],
    };
    writeSave(envelope, storage);
    const result = readSave(storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.eventLog).toHaveLength(4);
      expect(result.save.eventLog[2]).toMatchObject({ t: 'SELL_GEAR', index: 1 });
    }
  });
});

// ── representative event log ──────────────────────────────────────────────────

describe('representative full event log round-trip', () => {
  it('accepts START_RUN → CHOOSE_OPTION → RESOLVE_MINIGAME → override → PUSH_ON → CHOOSE_SCENARIO → CALL_GETAWAY → RESOLVE_GETAWAY', () => {
    const storage = makeMemoryStorage();
    const envelope: SaveEnvelope = {
      version: SAVE_VERSION,
      seed: 999,
      eventLog: [
        { t: 'START_RUN', crew: [{ name: 'River' }, { name: 'Sam', quirk: 'smooth-talker' as QuirkId }] },
        { t: 'CHOOSE_OPTION', optionId: 'opt-b', committed: ['player-0' as PlayerId, 'player-1' as PlayerId] },
        { t: 'RESOLVE_MINIGAME', outcome: 'complication' },
        { t: 'OVERRIDE_ADJUST_HEAT', delta: -1 },
        { t: 'PUSH_ON' },
        { t: 'CHOOSE_SCENARIO', choiceId: 'choice-a' },
        { t: 'CALL_GETAWAY' },
        { t: 'RESOLVE_GETAWAY' },
      ],
    };
    writeSave(envelope, storage);
    const result = readSave(storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.eventLog).toHaveLength(8);
      expect(result.save.eventLog[3]).toMatchObject({ t: 'OVERRIDE_ADJUST_HEAT', delta: -1 });
    }
  });
});
