export { loadDefaultConfig, loadDefaultNarration, loadDefaultSoundManifest, loadDefaultBundle } from './presets/browser';
export { buildConfig } from './presets/build-config';
export type { PresetBundle } from './presets/build-config';

export {
  listPresets,
  readPreset,
  writePreset,
  deletePreset,
  clonePreset,
  buildConfigFromPreset,
  buildConfigFromTuning,
} from './presets/preset-store';
export type { BuildConfigResult, PresetListEntry } from './presets/preset-store';

export { createAudioEngine, createBundledFetchBuffer, resolveSoundUrl } from './audio';
export type { AudioEngine, AudioEngineOptions, AudioClock, AudioClockOptions, ScheduledEntry } from './audio';

export { writeSave, readSave, clearSave } from './persistence/save';
export type { StorageLike, ReadSaveResult } from './persistence/save';

export { readSettings, writeSettings, clearSettings } from './persistence/settings';

export {
  readLeaderboard,
  writeLeaderboard,
  appendScore,
  clearLeaderboard,
  topEntries,
  personalBest,
} from './persistence/leaderboard';

export { publishSlice, subscribeToSlice, playerViewSliceSchema } from './channel';
export type { PlayerViewSlice, DefuseRulebookSlice } from './channel';
