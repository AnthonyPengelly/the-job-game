import { z } from 'zod';
import { safeParseSaveEnvelope, SAVE_VERSION } from '@/content/schema/save';
import type { SaveEnvelope } from '@/content/schema/save';

/** Minimal storage interface — satisfied by window.localStorage and in-memory stubs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Result of readSave. */
export type ReadSaveResult =
  | { ok: true; save: SaveEnvelope }
  | { ok: false; reason: 'absent' | 'stale' | 'corrupt' };

// Separate key per concern so clearing a run never wipes leaderboard/settings.
const RUN_SAVE_KEY = 'the-job:run-save';

/**
 * Serialise and write the save envelope to storage.
 * Writes through immediately — the save is durable after every engine event.
 * Swallows QuotaExceededError/SecurityError so a full or blocked localStorage
 * never throws at the table (golden rule: app never blocks).
 */
export function writeSave(
  env: SaveEnvelope,
  storage: StorageLike = window.localStorage,
): void {
  try {
    storage.setItem(RUN_SAVE_KEY, JSON.stringify(env));
  } catch {
    // QuotaExceededError / SecurityError in private-mode or full storage.
    // The run continues without persistence rather than crashing the GM.
  }
}

/**
 * Read, parse, and version-check the save from storage.
 *
 * - `absent`  – key not present in storage
 * - `stale`   – save parses but version !== SAVE_VERSION
 * - `corrupt` – JSON invalid or Zod schema rejects the data
 *
 * Never throws at the table.
 */
export function readSave(
  storage: StorageLike = window.localStorage,
): ReadSaveResult {
  const raw = storage.getItem(RUN_SAVE_KEY);
  if (raw === null) {
    return { ok: false, reason: 'absent' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }

  // Extract version before full-schema validation: a future-version save whose
  // eventLog schema has since diverged should classify as 'stale', not 'corrupt'.
  const versionOnly = z.object({ version: z.number() }).safeParse(parsed);
  if (versionOnly.success && versionOnly.data.version !== SAVE_VERSION) {
    return { ok: false, reason: 'stale' };
  }

  const result = safeParseSaveEnvelope(parsed);
  if (!result.success) {
    return { ok: false, reason: 'corrupt' };
  }

  return { ok: true, save: result.data };
}

/** Remove the run save from storage. */
export function clearSave(storage: StorageLike = window.localStorage): void {
  storage.removeItem(RUN_SAVE_KEY);
}
