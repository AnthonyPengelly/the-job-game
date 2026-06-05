import type { EngineConfig } from '@/engine/config';
import { tuningSchema, scalingSchema, metaSchema, roomTemplatesSchema, scenariosSchema, gearSchema, categoriesBankSchema, triviaBankSchema } from '@/content/schema';
import { buildConfig } from './build-config';

import metaJson from '../../../presets/default/_meta.json';
import tuningJson from '../../../presets/default/tuning.json';
import scalingJson from '../../../presets/default/scaling.json';
import roomTemplatesJson from '../../../presets/default/content/roomTemplates.json';
import scenariosJson from '../../../presets/default/content/scenarios.json';
import gearJson from '../../../presets/default/content/gear.json';
import categoriesJson from '../../../presets/default/content/banks/categories.json';
import triviaJson from '../../../presets/default/content/banks/trivia.json';

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
