import type { EngineConfig, GearDef, ObstacleOptionConfig, ObstacleTemplateConfig, TriviaItemConfig } from '@/engine/config';
import type { GearGrantDescriptor, ScenarioDef } from '@/engine/types';
import type { CategoriesBank, TriviaBank, ParsedGear, ParsedMeta, ParsedRoomTemplates, ParsedScaling, ParsedTuning, ParsedScenarios } from '@/content/schema';

export interface PresetBundle {
  meta: ParsedMeta;
  tuning: ParsedTuning;
  scaling: ParsedScaling;
  roomTemplates: ParsedRoomTemplates;
  scenarios: ParsedScenarios;
  gear: ParsedGear;
  categoriesBank: CategoriesBank;
  triviaBank: TriviaBank;
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

function buildGearGrant(raw: ParsedRoomTemplates['obstacles'][number]['options'][number]['gear']): GearGrantDescriptor | undefined {
  if (raw === undefined) return undefined;
  return {
    kind: raw.kind,
    ...(raw.lane !== undefined && { lane: raw.lane }),
    ...(raw.lanes !== undefined && { lanes: raw.lanes }),
  };
}

function buildObstacleOption(o: ParsedRoomTemplates['obstacles'][number]['options'][number]): ObstacleOptionConfig {
  const gear = buildGearGrant(o.gear);
  return { id: o.id, greedy: o.greedy, heatCost: o.heatCost, reward: o.reward,
    ...(gear !== undefined && { gear }) };
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

/**
 * Pass scenario defs through unchanged — ParsedScenarios items already match
 * the ScenarioDef shape validated by scenariosSchema.
 */
function buildScenarioDefs(raw: ParsedScenarios): ScenarioDef[] {
  return raw.items as unknown as ScenarioDef[];
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
  const { tuning, scaling, roomTemplates, scenarios, gear, categoriesBank, triviaBank } = bundle;

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
      brief: tuning.getaway.brief,
      ditchHeatCost: tuning.getaway.ditchHeatCost,
      buySecondsBonus: tuning.getaway.buySecondsBonus,
    },
    scoring: tuning.scoring,
    generation: tuning.generation,
    scenario: {
      dcClamp: tuning.scenario.dcClamp,
      easeDialSteps: tuning.scenario.easeDialSteps,
      critFumble: tuning.scenario.critFumble,
      heatDC: tuning.scenario.heatDC,
    },
    rewardScale: tuning.rewardScale,
    gearSellValue: tuning.gearSellValue,
    scaling: {
      profiles,
      exhaustionRest: scaling.exhaustionRest,
      minCommit: scaling.minCommit,
      variant: scaling.variant,
      excludedFromSolo: scaling.excludedFromSolo,
      soloEligibleMinPool: scaling.soloEligibleMinPool,
      dialCurve: scaling.dialCurve,
      heatDial: scaling.heatDial,
    },
    roomTemplates: {
      obstacles: buildObstacleTemplates(roomTemplates),
      scenarios: buildScenarioDefs(scenarios),
    },
    gear: buildGearCatalog(gear),
    banks: {
      categories: categoriesBank.items,
      trivia: triviaBank.items.map((item): TriviaItemConfig => ({
        question: item.question,
        answer: item.answer,
        tier: item.tier,
        ...(item.options !== undefined ? { options: item.options } : {}),
      })),
    },
  };

  return deepFreeze(config);
}
