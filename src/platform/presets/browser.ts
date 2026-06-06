import type { EngineConfig } from '@/engine/config';
import { tuningSchema, scalingSchema, metaSchema, roomTemplatesSchema, scenariosSchema, gearSchema, categoriesBankSchema, triviaBankSchema, narrationSchema, soundManifestSchema } from '@/content/schema';
import type { ParsedNarration, ParsedSoundManifest } from '@/content/schema';
import { buildConfig } from './build-config';

import metaJson from '../../../presets/default/_meta.json';
import tuningJson from '../../../presets/default/tuning.json';
import scalingJson from '../../../presets/default/scaling.json';
import roomTemplatesJson from '../../../presets/default/content/roomTemplates.json';
import scenariosJson from '../../../presets/default/content/scenarios.json';
import gearJson from '../../../presets/default/content/gear.json';
import categoriesJson from '../../../presets/default/content/banks/categories.json';
import triviaJson from '../../../presets/default/content/banks/trivia.json';
import narrationJson from '../../../presets/default/content/narration.json';
import soundJson from '../../../presets/default/content/sound.json';

export function loadDefaultConfig(): EngineConfig {
  const meta = metaSchema.parse(metaJson);
  const tuning = tuningSchema.parse(tuningJson);
  const scaling = scalingSchema.parse(scalingJson);
  const roomTemplates = roomTemplatesSchema.parse(roomTemplatesJson);
  const scenarios = scenariosSchema.parse(scenariosJson);
  const gear = gearSchema.parse(gearJson);
  const categoriesBank = categoriesBankSchema.parse(categoriesJson);
  const triviaBank = triviaBankSchema.parse(triviaJson);
  return buildConfig({ meta, tuning, scaling, roomTemplates, scenarios, gear, categoriesBank, triviaBank });
}

/**
 * Parses the bundled default narration bank.
 * Returned separately from EngineConfig so narration never enters the engine or sim.
 */
export function loadDefaultNarration(): ParsedNarration {
  return narrationSchema.parse(narrationJson);
}

/**
 * Parses the bundled default sound manifest.
 * Returned separately from EngineConfig so the manifest never enters the engine or sim.
 */
export function loadDefaultSoundManifest(): ParsedSoundManifest {
  return soundManifestSchema.parse(soundJson);
}
