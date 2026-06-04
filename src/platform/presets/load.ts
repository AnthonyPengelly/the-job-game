/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import type { EngineConfig, GearDef, ObstacleOptionConfig, ObstacleTemplateConfig, ScenarioChoiceConfig, ScenarioTemplateConfig } from '@/engine/config';
import { tuningSchema, scalingSchema, metaSchema, roomTemplatesSchema, gearSchema } from '@/content/schema';
import type { ParsedGear, ParsedRoomTemplates } from '@/content/schema';

function readJson(dir: string, file: string): unknown {
  return JSON.parse(readFileSync(resolve(dir, file), 'utf-8'));
}

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }
  return obj;
}

function buildObstacleTemplates(raw: ParsedRoomTemplates): ObstacleTemplateConfig[] {
  return raw.obstacles.map(t => ({
    id: t.id,
    gameId: t.gameId,
    lane: t.lane,
    options: [
      buildObstacleOption(t.options[0]),
      buildObstacleOption(t.options[1]),
    ] as [ObstacleOptionConfig, ObstacleOptionConfig],
  } satisfies ObstacleTemplateConfig));
}

function buildObstacleOption(o: ParsedRoomTemplates['obstacles'][number]['options'][number]): ObstacleOptionConfig {
  return { id: o.id, greedy: o.greedy, heatCost: o.heatCost, reward: o.reward };
}

function buildScenarioTemplates(raw: ParsedRoomTemplates): ScenarioTemplateConfig[] {
  return raw.scenarios.map(s => ({
    id: s.id,
    choices: [
      buildScenarioChoice(s.choices[0]),
      buildScenarioChoice(s.choices[1]),
    ] as [ScenarioChoiceConfig, ScenarioChoiceConfig],
  } satisfies ScenarioTemplateConfig));
}

function buildScenarioChoice(c: ParsedRoomTemplates['scenarios'][number]['choices'][number]): ScenarioChoiceConfig {
  return { id: c.id, label: c.label, heatDelta: c.heatDelta, lootDelta: c.lootDelta };
}

function buildGearCatalog(raw: ParsedGear): Record<string, GearDef> {
  const gear: Record<string, GearDef> = {};
  for (const item of raw.items) {
    if (item.kind === 'statBoost') {
      gear[item.id] = { id: item.id, kind: 'statBoost', lane: item.lane, magnitude: item.magnitude };
    } else {
      gear[item.id] = { id: item.id, kind: 'powerUp', lane: item.lane };
    }
  }
  return gear;
}

/**
 * Reads tuning.json, scaling.json, _meta.json, and content/roomTemplates.json
 * from presets/<id>/, Zod-parses each one (fails loudly on any malformed field),
 * and returns a frozen EngineConfig containing exactly the numbers the engine needs.
 *
 * Content packs beyond roomTemplates (scenarios, gear, etc.) are out of scope
 * for E1 — only tuning + scaling + meta + roomTemplates are loaded here.
 */
export function loadPreset(id = 'default'): EngineConfig {
  const dir = resolve(cwd(), 'presets', id);

  // Parse all files — any malformed field throws a ZodError with path.
  metaSchema.parse(readJson(dir, '_meta.json'));
  const tuning = tuningSchema.parse(readJson(dir, 'tuning.json'));
  const scaling = scalingSchema.parse(readJson(dir, 'scaling.json'));
  const roomTemplatesRaw = roomTemplatesSchema.parse(
    readJson(resolve(dir, 'content'), 'roomTemplates.json'),
  );
  const gearRaw = gearSchema.parse(readJson(resolve(dir, 'content'), 'gear.json'));

  // Build the profiles sub-map with the full per-headcount shape.
  const profiles: Record<string, { getawayBonus: number; crewPerOption: [number, number]; exhaustion: 'full' | 'light' | 'tired' }> = {};
  for (const [key, profile] of Object.entries(scaling.profiles)) {
    profiles[key] = {
      getawayBonus: profile.getawayBonus,
      crewPerOption: profile.crewPerOption,
      exhaustion: profile.exhaustion,
    };
  }

  const config: EngineConfig = {
    heat: tuning.heat,
    escalation: tuning.escalation,
    obstacleHeat: tuning.obstacleHeat,
    outcomeHeat: tuning.outcomeHeat,
    outcomeLoot: tuning.outcomeLoot,
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
      exhaustionRest: scaling.exhaustionRest,
      minCommit: scaling.minCommit,
      variant: scaling.variant,
      excludedFromSolo: scaling.excludedFromSolo,
      soloEligibleMinPool: scaling.soloEligibleMinPool,
      dialCurve: scaling.dialCurve,
    },
    generation: tuning.generation,
    roomTemplates: {
      obstacles: buildObstacleTemplates(roomTemplatesRaw),
      scenarios: buildScenarioTemplates(roomTemplatesRaw),
    },
    gear: buildGearCatalog(gearRaw),
  };

  return deepFreeze(config);
}
