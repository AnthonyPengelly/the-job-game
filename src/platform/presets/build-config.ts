import type { EngineConfig, GearDef, ObstacleOptionConfig, ObstacleTemplateConfig, ScenarioChoiceConfig, ScenarioTemplateConfig } from '@/engine/config';
import type { ParsedGear, ParsedMeta, ParsedRoomTemplates, ParsedScaling, ParsedTuning } from '@/content/schema';

export interface PresetBundle {
  meta: ParsedMeta;
  tuning: ParsedTuning;
  scaling: ParsedScaling;
  roomTemplates: ParsedRoomTemplates;
  gear: ParsedGear;
}

export function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }
  return obj;
}

function buildObstacleOption(o: ParsedRoomTemplates['obstacles'][number]['options'][number]): ObstacleOptionConfig {
  return { id: o.id, greedy: o.greedy, heatCost: o.heatCost, reward: o.reward };
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

function buildScenarioChoice(c: ParsedRoomTemplates['scenarios'][number]['choices'][number]): ScenarioChoiceConfig {
  return { id: c.id, label: c.label, heatDelta: c.heatDelta, lootDelta: c.lootDelta };
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

export function buildConfig(bundle: PresetBundle): EngineConfig {
  const { tuning, scaling, roomTemplates, gear } = bundle;

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
      obstacles: buildObstacleTemplates(roomTemplates),
      scenarios: buildScenarioTemplates(roomTemplates),
    },
    gear: buildGearCatalog(gear),
  };

  return deepFreeze(config);
}
