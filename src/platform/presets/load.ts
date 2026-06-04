/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import type { EngineConfig } from '@/engine/config';
import { tuningSchema, scalingSchema, metaSchema } from '@/content/schema';

function readJson(dir: string, file: string): unknown {
  return JSON.parse(readFileSync(resolve(dir, file), 'utf-8'));
}

/**
 * Reads tuning.json, scaling.json, and _meta.json from presets/<id>/,
 * Zod-parses each one (fails loudly on any malformed field), and returns a
 * frozen EngineConfig containing exactly the numbers the engine needs.
 *
 * Content packs (scenarios, gear, etc.) are out of scope for E1 — only
 * tuning + scaling + meta are loaded here.
 */
export function loadPreset(id = 'default'): EngineConfig {
  const dir = resolve(cwd(), 'presets', id);

  // Parse all three files — any malformed field throws a ZodError with path.
  metaSchema.parse(readJson(dir, '_meta.json'));
  const tuning = tuningSchema.parse(readJson(dir, 'tuning.json'));
  const scaling = scalingSchema.parse(readJson(dir, 'scaling.json'));

  // Build the profiles sub-map with only what EngineConfig exposes.
  const profiles: Record<string, { getawayBonus: number }> = {};
  for (const [key, profile] of Object.entries(scaling.profiles)) {
    profiles[key] = { getawayBonus: profile.getawayBonus };
  }

  const config: EngineConfig = {
    heat: tuning.heat,
    escalation: tuning.escalation,
    obstacleHeat: tuning.obstacleHeat,
    outcomeHeat: tuning.outcomeHeat,
    scenarioSwing: tuning.scenarioSwing,
    getaway: {
      exponent: tuning.getaway.exponent,
      skillTerm: tuning.getaway.skillTerm,
      skillPivot: tuning.getaway.skillPivot,
      headcountTerm: tuning.getaway.headcountTerm,
      clamp: tuning.getaway.clamp,
    },
    scoring: tuning.scoring,
    scaling: {
      profiles,
      minCommit: scaling.minCommit,
    },
  };

  return Object.freeze(config);
}
