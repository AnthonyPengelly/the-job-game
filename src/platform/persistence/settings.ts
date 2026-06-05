import { SETTINGS_VERSION, settingsSchema, DEFAULT_SETTINGS } from '@/content/schema/settings';
import type { Settings } from '@/content/schema/settings';
import type { StorageLike } from './save';

const SETTINGS_KEY = 'the-job:settings';

/**
 * Read and validate settings from storage.
 * On absent key: returns default silently.
 * On malformed JSON, schema error, or version mismatch: logs a warning, writes
 * default back, and returns the default — never throws at the table.
 */
export function readSettings(storage: StorageLike = window.localStorage): Settings {
  const raw = storage.getItem(SETTINGS_KEY);
  if (raw === null) {
    return { ...DEFAULT_SETTINGS };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[the-job] settings: malformed JSON — resetting to default');
    writeSettings(DEFAULT_SETTINGS, storage);
    return { ...DEFAULT_SETTINGS };
  }

  const result = settingsSchema.safeParse(parsed);
  if (!result.success) {
    console.warn('[the-job] settings: invalid schema — resetting to default', result.error.message);
    writeSettings(DEFAULT_SETTINGS, storage);
    return { ...DEFAULT_SETTINGS };
  }

  if (result.data.version !== SETTINGS_VERSION) {
    console.warn('[the-job] settings: version mismatch — resetting to default');
    writeSettings(DEFAULT_SETTINGS, storage);
    return { ...DEFAULT_SETTINGS };
  }

  return result.data;
}

/**
 * Write settings to storage.
 * Swallows QuotaExceededError/SecurityError so a full storage never crashes the app.
 */
export function writeSettings(
  settings: Settings,
  storage: StorageLike = window.localStorage,
): void {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // QuotaExceededError / SecurityError in private-mode or full storage.
  }
}

/** Remove the settings entry from storage. */
export function clearSettings(storage: StorageLike = window.localStorage): void {
  storage.removeItem(SETTINGS_KEY);
}
