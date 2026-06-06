import { describe, it, expect, beforeEach } from 'vitest';
import {
  readLeaderboard,
  writeLeaderboard,
  appendScore,
  clearLeaderboard,
  topEntries,
  personalBest,
} from './leaderboard';
import type { StorageLike } from './save';
import { LEADERBOARD_VERSION } from '@/content/schema/leaderboard';
import type { LeaderboardEntry } from '@/content/schema/leaderboard';

// ── In-memory storage stub ────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    runSeed: 42,
    score: 30.0,
    loot: 20,
    heatAtGetaway: 5,
    win: true,
    crewSize: 3,
    finishedAt: 1700000000000,
    ...overrides,
  };
}

// ── readLeaderboard ───────────────────────────────────────────────────────────

describe('readLeaderboard', () => {
  it('returns an empty envelope when key is absent', () => {
    const storage = makeStorage();
    const result = readLeaderboard(storage);
    expect(result.version).toBe(LEADERBOARD_VERSION);
    expect(result.entries).toHaveLength(0);
  });

  it('returns an empty envelope for malformed JSON', () => {
    const storage = makeStorage();
    storage.setItem('the-job:leaderboard', '{ not valid json }');
    const result = readLeaderboard(storage);
    expect(result.entries).toHaveLength(0);
  });

  it('returns an empty envelope for a schema-invalid object', () => {
    const storage = makeStorage();
    storage.setItem('the-job:leaderboard', JSON.stringify({ version: 1, entries: 'nope' }));
    const result = readLeaderboard(storage);
    expect(result.entries).toHaveLength(0);
  });

  it('returns an empty envelope for a version mismatch', () => {
    const storage = makeStorage();
    storage.setItem(
      'the-job:leaderboard',
      JSON.stringify({ version: LEADERBOARD_VERSION + 99, entries: [] }),
    );
    const result = readLeaderboard(storage);
    expect(result.entries).toHaveLength(0);
  });

  it('round-trips a valid envelope', () => {
    const storage = makeStorage();
    const entry = makeEntry();
    writeLeaderboard({ version: LEADERBOARD_VERSION, entries: [entry] }, storage);
    const result = readLeaderboard(storage);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ runSeed: 42, score: 30.0 });
  });
});

// ── writeLeaderboard error resilience ─────────────────────────────────────────

describe('writeLeaderboard error resilience', () => {
  it('does not throw when storage.setItem throws QuotaExceededError', () => {
    const throwingStorage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
    };
    expect(() =>
      writeLeaderboard({ version: LEADERBOARD_VERSION, entries: [] }, throwingStorage),
    ).not.toThrow();
  });
});

// ── appendScore ───────────────────────────────────────────────────────────────

describe('appendScore', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = makeStorage();
  });

  it('appends a new entry when the leaderboard is empty', () => {
    const entry = makeEntry({ runSeed: 1, score: 25 });
    const result = appendScore(entry, storage);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ runSeed: 1, score: 25 });
  });

  it('appends entries with different seeds as separate records', () => {
    appendScore(makeEntry({ runSeed: 1, score: 20 }), storage);
    appendScore(makeEntry({ runSeed: 2, score: 35 }), storage);
    const { entries } = readLeaderboard(storage);
    expect(entries).toHaveLength(2);
  });

  it('upserts when same seed arrives with a higher score (new entry wins)', () => {
    appendScore(makeEntry({ runSeed: 7, score: 20 }), storage);
    appendScore(makeEntry({ runSeed: 7, score: 40 }), storage);
    const { entries } = readLeaderboard(storage);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.score).toBe(40);
  });

  it('keeps the old entry when same seed arrives with a lower or equal score', () => {
    appendScore(makeEntry({ runSeed: 7, score: 40 }), storage);
    appendScore(makeEntry({ runSeed: 7, score: 30 }), storage);
    const { entries } = readLeaderboard(storage);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.score).toBe(40);
  });

  it('does not duplicate when called twice with the same seed+score', () => {
    const entry = makeEntry({ runSeed: 5, score: 50 });
    appendScore(entry, storage);
    appendScore(entry, storage);
    expect(readLeaderboard(storage).entries).toHaveLength(1);
  });

  it('persists to storage so a new readLeaderboard call sees the entry', () => {
    appendScore(makeEntry({ runSeed: 3, score: 15 }), storage);
    const second = readLeaderboard(storage);
    expect(second.entries).toHaveLength(1);
  });
});

// ── clearLeaderboard ──────────────────────────────────────────────────────────

describe('clearLeaderboard', () => {
  it('removes the key so readLeaderboard returns empty', () => {
    const storage = makeStorage();
    appendScore(makeEntry(), storage);
    expect(readLeaderboard(storage).entries).toHaveLength(1);
    clearLeaderboard(storage);
    expect(readLeaderboard(storage).entries).toHaveLength(0);
  });
});

// ── topEntries / personalBest ─────────────────────────────────────────────────

describe('topEntries', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = makeStorage();
    appendScore(makeEntry({ runSeed: 1, score: 10 }), storage);
    appendScore(makeEntry({ runSeed: 2, score: 50 }), storage);
    appendScore(makeEntry({ runSeed: 3, score: 30 }), storage);
  });

  it('returns the top N entries sorted by score descending', () => {
    const top2 = topEntries(2, storage);
    expect(top2).toHaveLength(2);
    expect(top2[0]!.score).toBe(50);
    expect(top2[1]!.score).toBe(30);
  });

  it('returns all entries when n exceeds the list length', () => {
    const all = topEntries(100, storage);
    expect(all).toHaveLength(3);
    expect(all[0]!.score).toBe(50);
  });

  it('returns an empty array when the leaderboard is empty', () => {
    clearLeaderboard(storage);
    expect(topEntries(5, storage)).toHaveLength(0);
  });
});

describe('personalBest', () => {
  it('returns the highest-scoring entry', () => {
    const storage = makeStorage();
    appendScore(makeEntry({ runSeed: 1, score: 20 }), storage);
    appendScore(makeEntry({ runSeed: 2, score: 60 }), storage);
    appendScore(makeEntry({ runSeed: 3, score: 40 }), storage);
    const best = personalBest(storage);
    expect(best).not.toBeNull();
    expect(best!.score).toBe(60);
  });

  it('returns null when the leaderboard is empty', () => {
    const storage = makeStorage();
    expect(personalBest(storage)).toBeNull();
  });
});

// ── undo/redo dedupe invariant ────────────────────────────────────────────────

describe('dedupe-by-seed invariant (undo/redo simulation)', () => {
  it('does not duplicate when undo then redo re-triggers appendScore with the same seed', () => {
    const storage = makeStorage();
    // Simulate: finish run, undo back to getaway, redo/finish again
    appendScore(makeEntry({ runSeed: 42, score: 30 }), storage);
    appendScore(makeEntry({ runSeed: 42, score: 30 }), storage); // same score, second call
    expect(readLeaderboard(storage).entries).toHaveLength(1);
  });

  it('keeps the best score when redo yields a different (higher) score', () => {
    const storage = makeStorage();
    appendScore(makeEntry({ runSeed: 42, score: 30 }), storage);
    appendScore(makeEntry({ runSeed: 42, score: 45 }), storage); // better result on redo
    const { entries } = readLeaderboard(storage);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.score).toBe(45);
  });
});
