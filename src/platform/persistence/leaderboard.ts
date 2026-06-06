import { z } from 'zod';
import {
  LEADERBOARD_VERSION,
  leaderboardEnvelopeSchema,
} from '@/content/schema/leaderboard';
import type { LeaderboardEntry, LeaderboardEnvelope } from '@/content/schema/leaderboard';
import type { StorageLike } from './save';

const LEADERBOARD_KEY = 'the-job:leaderboard';

const EMPTY_ENVELOPE: LeaderboardEnvelope = { version: LEADERBOARD_VERSION, entries: [] };

function makeEmpty(): LeaderboardEnvelope {
  return { version: LEADERBOARD_VERSION, entries: [] };
}

/**
 * Read and validate the leaderboard from storage.
 * Absent key, malformed JSON, schema mismatch, or version change all reset to
 * an empty envelope — never throws at the table.
 */
export function readLeaderboard(
  storage: StorageLike = window.localStorage,
): LeaderboardEnvelope {
  const raw = storage.getItem(LEADERBOARD_KEY);
  if (raw === null) return makeEmpty();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return makeEmpty();
  }

  const versionOnly = z.object({ version: z.number() }).safeParse(parsed);
  if (versionOnly.success && versionOnly.data.version !== LEADERBOARD_VERSION) {
    return makeEmpty();
  }

  const result = leaderboardEnvelopeSchema.safeParse(parsed);
  return result.success ? result.data : makeEmpty();
}

/**
 * Write the leaderboard envelope to storage.
 * Swallows QuotaExceededError/SecurityError so storage pressure never crashes the GM.
 */
export function writeLeaderboard(
  envelope: LeaderboardEnvelope,
  storage: StorageLike = window.localStorage,
): void {
  try {
    storage.setItem(LEADERBOARD_KEY, JSON.stringify(envelope));
  } catch {
    // QuotaExceededError / SecurityError in private-mode or full storage.
  }
}

/**
 * Upsert a finished run into the leaderboard.
 *
 * Deduplication: if an entry with the same `runSeed` already exists, the one
 * with the higher `score` wins. Undo/redo across the result boundary therefore
 * never creates duplicate entries.
 *
 * Returns the updated envelope (entries are NOT sorted — callers may sort).
 */
export function appendScore(
  entry: LeaderboardEntry,
  storage: StorageLike = window.localStorage,
): LeaderboardEnvelope {
  const envelope = readLeaderboard(storage);
  const existingIdx = envelope.entries.findIndex(e => e.runSeed === entry.runSeed);

  let entries: LeaderboardEntry[];
  if (existingIdx === -1) {
    entries = [...envelope.entries, entry];
  } else {
    const existing = envelope.entries[existingIdx]!;
    if (entry.score > existing.score) {
      entries = [
        ...envelope.entries.slice(0, existingIdx),
        entry,
        ...envelope.entries.slice(existingIdx + 1),
      ];
    } else {
      // Old entry was better — no write needed.
      return envelope;
    }
  }

  const newEnvelope: LeaderboardEnvelope = { version: LEADERBOARD_VERSION, entries };
  writeLeaderboard(newEnvelope, storage);
  return newEnvelope;
}

/** Remove the leaderboard from storage (does not affect the run save or settings). */
export function clearLeaderboard(
  storage: StorageLike = window.localStorage,
): void {
  storage.removeItem(LEADERBOARD_KEY);
}

/**
 * Return the top N entries sorted by score descending.
 * Pass `Number.MAX_SAFE_INTEGER` (or a large number) to get all entries.
 */
export function topEntries(
  n: number,
  storage: StorageLike = window.localStorage,
): LeaderboardEntry[] {
  const { entries } = readLeaderboard(storage);
  return [...entries].sort((a, b) => b.score - a.score).slice(0, n);
}

/** Return the single highest-scoring entry across all runs, or null if the leaderboard is empty. */
export function personalBest(
  storage: StorageLike = window.localStorage,
): LeaderboardEntry | null {
  return topEntries(1, storage)[0] ?? null;
}

// Re-export EMPTY_ENVELOPE shape for tests that need a baseline.
export { EMPTY_ENVELOPE };
