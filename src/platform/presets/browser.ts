import type { EngineConfig } from '@/engine/config';
import { tuningSchema, scalingSchema, metaSchema, roomTemplatesSchema, gearSchema, categoriesBankSchema } from '@/content/schema';
import { buildConfig } from './build-config';

import metaJson from '../../../presets/default/_meta.json';
import tuningJson from '../../../presets/default/tuning.json';
import scalingJson from '../../../presets/default/scaling.json';
import roomTemplatesJson from '../../../presets/default/content/roomTemplates.json';
import gearJson from '../../../presets/default/content/gear.json';
import categoriesJson from '../../../presets/default/content/banks/categories.json';

export function loadDefaultConfig(): EngineConfig {
  const meta = metaSchema.parse(metaJson);
  const tuning = tuningSchema.parse(tuningJson);
  const scaling = scalingSchema.parse(scalingJson);
  const roomTemplates = roomTemplatesSchema.parse(roomTemplatesJson);
  const gear = gearSchema.parse(gearJson);
  const categoriesBank = categoriesBankSchema.parse(categoriesJson);
  return buildConfig({ meta, tuning, scaling, roomTemplates, gear, categoriesBank });
}
