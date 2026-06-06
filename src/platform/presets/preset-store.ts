import { z } from 'zod';
import type { EngineConfig } from '@/engine/config';
import type { UserPreset } from '@/content/schema/user-preset';
import { tuningSchema } from '@/content/schema';
import type { StorageLike } from '@/platform/persistence/save';
import { buildConfig } from './build-config';
import { loadDefaultBundle } from './browser';

// Separate key so clearing presets never wipes run-saves, settings, or leaderboard.
const PRESETS_KEY = 'the-job:presets';

// ── Public types ──────────────────────────────────────────────────────────────

export type BuildConfigResult =
  | { ok: true; cfg: EngineConfig }
  | { ok: false; error: string; path?: string };

export interface PresetListEntry {
  id: string;
  name: string;
  isBuiltIn: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// Lenient storage schema: validates outer shape and that tuning is an object,
// but NOT tuning value ranges. This allows presets with temporarily invalid
// tuning (e.g. a slider out-of-range) to be stored and retrieved; strict
// validation happens in buildConfigFromPreset, which returns a clear error.
// "Malformed" here means structurally broken (wrong id type, missing fields,
// non-object tuning) — those are skipped at the boundary. Out-of-range values
// are not malformed; they are handled by buildConfigFromPreset.
const loosePresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseId: z.literal('default'),
  tuning: z.object({}).passthrough(),
});

type LoosePreset = { id: string; name: string; baseId: 'default'; tuning: Record<string, unknown> };

function readAll(storage: StorageLike): Record<string, LoosePreset> {
  const raw = storage.getItem(PRESETS_KEY);
  if (raw === null) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[the-job] presets: malformed JSON — clearing preset store');
    storage.removeItem(PRESETS_KEY);
    return {};
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.warn('[the-job] presets: unexpected store shape — clearing preset store');
    storage.removeItem(PRESETS_KEY);
    return {};
  }

  const out: Record<string, LoosePreset> = {};
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    const result = loosePresetSchema.safeParse(value);
    if (result.success) {
      out[id] = result.data as LoosePreset;
    } else {
      // Skip structurally malformed presets loudly — never crash the table.
      console.warn(`[the-job] presets: skipping malformed preset "${id}":`, result.error.message);
    }
  }
  return out;
}

function writeAll(presets: Record<string, LoosePreset | UserPreset>, storage: StorageLike): void {
  try {
    storage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // QuotaExceededError / SecurityError — run continues without persistence.
  }
}

let _seq = 0;
function mintId(): string {
  return `user-${Date.now().toString(36)}-${(++_seq).toString(36)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the built-in default entry followed by all saved user presets.
 * The 'default' entry is always first and cannot be overwritten by a user preset.
 */
export function listPresets(storage: StorageLike = window.localStorage): PresetListEntry[] {
  const all = readAll(storage);
  const entries: PresetListEntry[] = [
    { id: 'default', name: 'Default', isBuiltIn: true },
  ];
  for (const preset of Object.values(all)) {
    entries.push({ id: preset.id, name: preset.name, isBuiltIn: false });
  }
  return entries;
}

/**
 * Returns the full preset for a given id, or null if not found.
 * 'default' is synthesised from the bundled tuning — it is never stored in
 * localStorage and cannot be deleted or overwritten.
 *
 * Note: the returned preset's tuning may have out-of-range values if the user
 * saved an edit in progress. Call buildConfigFromPreset to get a validated config.
 */
export function readPreset(
  id: string,
  storage: StorageLike = window.localStorage,
): UserPreset | null {
  if (id === 'default') {
    const bundle = loadDefaultBundle();
    return { id: 'default', name: 'Default', baseId: 'default', tuning: bundle.tuning };
  }
  const all = readAll(storage);
  const found = all[id];
  if (!found) return null;
  // Outer structure validated by loosePresetSchema; tuning may have invalid
  // value ranges (validated lazily by buildConfigFromPreset).
  return found as unknown as UserPreset;
}

/**
 * Persist a user preset. The built-in 'default' id is protected and cannot be
 * overwritten; the call is silently ignored.
 */
export function writePreset(
  preset: UserPreset,
  storage: StorageLike = window.localStorage,
): void {
  if (preset.id === 'default') {
    console.warn('[the-job] presets: cannot overwrite the built-in default preset');
    return;
  }
  const all = readAll(storage);
  all[preset.id] = preset;
  writeAll(all, storage);
}

/**
 * Remove a user preset by id. The built-in 'default' preset cannot be deleted.
 */
export function deletePreset(
  id: string,
  storage: StorageLike = window.localStorage,
): void {
  if (id === 'default') {
    console.warn('[the-job] presets: cannot delete the built-in default preset');
    return;
  }
  const all = readAll(storage);
  delete all[id];
  writeAll(all, storage);
}

/**
 * Deep-copy a preset (by id) into a new named user preset with a fresh id.
 * Throws if the source id is not found. The copy is saved and returned.
 */
export function clonePreset(
  fromId: string,
  newName: string,
  storage: StorageLike = window.localStorage,
): UserPreset {
  const source = readPreset(fromId, storage);
  if (!source) {
    throw new Error(`[the-job] presets: cannot clone — preset "${fromId}" not found`);
  }

  const newId = mintId();
  // JSON round-trip deep-copies the tuning; the source is already validated or
  // synthesised from the default bundle, so the shape is safe to cast.
  const clonedTuning = JSON.parse(JSON.stringify(source.tuning)) as UserPreset['tuning'];
  const newPreset: UserPreset = {
    id: newId,
    name: newName,
    baseId: 'default',
    tuning: clonedTuning,
  };

  writePreset(newPreset, storage);
  return newPreset;
}

/**
 * Validate a raw tuning object (e.g. the panel's working copy) and build a
 * frozen EngineConfig. Returns `{ ok: true, cfg }` on success, or
 * `{ ok: false, error, path }` on failure — never throws.
 * Used by the tuning panel to validate the in-memory working copy before
 * saving or selecting.
 */
export function buildConfigFromTuning(rawTuning: unknown): BuildConfigResult {
  const tuningResult = tuningSchema.safeParse(rawTuning);
  if (!tuningResult.success) {
    const issue = tuningResult.error.issues[0];
    if (issue) {
      const dotPath = issue.path.join('.');
      const fieldPath = dotPath ? `tuning.${dotPath}` : 'tuning';
      return { ok: false, error: `${fieldPath}: ${issue.message}`, path: fieldPath };
    }
    return { ok: false, error: tuningResult.error.message };
  }
  const bundle = loadDefaultBundle();
  try {
    const cfg = buildConfig({ ...bundle, tuning: tuningResult.data });
    return { ok: true, cfg };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Validate a preset's tuning and build a frozen EngineConfig.
 * Returns `{ ok: true, cfg }` on success, or `{ ok: false, error, path }` on
 * failure — never throws, never returns a partially-built config.
 *
 * For user presets the tuning is re-validated via tuningSchema.safeParse before
 * building, so an out-of-range slider value surfaces a human-readable error
 * (e.g. "tuning.heat.runAtFraction: Number must be less than 1") rather than
 * throwing inside buildConfig.
 */
export function buildConfigFromPreset(
  id: string,
  storage: StorageLike = window.localStorage,
): BuildConfigResult {
  if (id === 'default') {
    try {
      const cfg = buildConfig(loadDefaultBundle());
      return { ok: true, cfg };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  // Read via the lenient schema so out-of-range tuning values are returned and
  // then validated below (rather than silently returning "not found").
  const all = readAll(storage);
  const raw = all[id];
  if (!raw) {
    return { ok: false, error: `Preset "${id}" not found` };
  }

  const tuningResult = tuningSchema.safeParse(raw.tuning);
  if (!tuningResult.success) {
    const issue = tuningResult.error.issues[0];
    if (issue) {
      const dotPath = issue.path.join('.');
      const fieldPath = dotPath ? `tuning.${dotPath}` : 'tuning';
      return { ok: false, error: `${fieldPath}: ${issue.message}`, path: fieldPath };
    }
    return { ok: false, error: tuningResult.error.message };
  }

  const bundle = loadDefaultBundle();
  try {
    const cfg = buildConfig({ ...bundle, tuning: tuningResult.data });
    return { ok: true, cfg };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
