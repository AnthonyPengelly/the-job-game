export { loadDefaultConfig } from './presets/browser';
export { buildConfig } from './presets/build-config';
export type { PresetBundle } from './presets/build-config';

export { writeSave, readSave, clearSave } from './persistence/save';
export type { StorageLike, ReadSaveResult } from './persistence/save';
