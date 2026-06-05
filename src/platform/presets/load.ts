/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import type { EngineConfig } from '@/engine/config';
import { tuningSchema, scalingSchema, metaSchema, roomTemplatesSchema, gearSchema, categoriesBankSchema } from '@/content/schema';
import { buildConfig } from './build-config';

function readJson(dir: string, file: string): unknown {
  return JSON.parse(readFileSync(resolve(dir, file), 'utf-8'));
}

/**
 * Reads tuning.json, scaling.json, _meta.json, content/roomTemplates.json,
 * and content/gear.json from presets/<id>/, Zod-parses each one (fails loudly
 * on any malformed field), and returns a frozen EngineConfig.
 */
export function loadPreset(id = 'default'): EngineConfig {
  const dir = resolve(cwd(), 'presets', id);

  const meta = metaSchema.parse(readJson(dir, '_meta.json'));
  const tuning = tuningSchema.parse(readJson(dir, 'tuning.json'));
  const scaling = scalingSchema.parse(readJson(dir, 'scaling.json'));
  const roomTemplates = roomTemplatesSchema.parse(
    readJson(resolve(dir, 'content'), 'roomTemplates.json'),
  );
  const gear = gearSchema.parse(readJson(resolve(dir, 'content'), 'gear.json'));
  const categoriesBank = categoriesBankSchema.parse(
    readJson(resolve(dir, 'content', 'banks'), 'categories.json'),
  );

  return buildConfig({ meta, tuning, scaling, roomTemplates, gear, categoriesBank });
}
