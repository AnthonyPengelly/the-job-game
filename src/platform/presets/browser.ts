import type { EngineConfig } from '@/engine/config';
import { tuningSchema, scalingSchema, metaSchema, roomTemplatesSchema, gearSchema } from '@/content/schema';
import { buildConfig } from './build-config';

import metaJson from '../../../presets/default/_meta.json';
import tuningJson from '../../../presets/default/tuning.json';
import scalingJson from '../../../presets/default/scaling.json';
import roomTemplatesJson from '../../../presets/default/content/roomTemplates.json';
import gearJson from '../../../presets/default/content/gear.json';

export function loadDefaultConfig(): EngineConfig {
  const meta = metaSchema.parse(metaJson);
  const tuning = tuningSchema.parse(tuningJson);
  const scaling = scalingSchema.parse(scalingJson);
  const roomTemplates = roomTemplatesSchema.parse(roomTemplatesJson);
  const gear = gearSchema.parse(gearJson);
  return buildConfig({ meta, tuning, scaling, roomTemplates, gear });
}
