export { loadDefaultConfig, loadDefaultNarration, loadDefaultSoundManifest } from './presets/browser';
export { buildConfig } from './presets/build-config';
export type { PresetBundle } from './presets/build-config';

export { createAudioEngine } from './audio';
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
