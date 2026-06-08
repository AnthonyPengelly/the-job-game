import { z } from 'zod';

const tuningPackMetaSchema = z.object({
  pack: z.literal('tuning'),
  version: z.number().int().positive(),
  source: z.string(),
  units: z.record(z.string(), z.string()),
}).strict();

export const tuningSchema = z.object({
  _meta: tuningPackMetaSchema,
  heat: z.object({
    hMax: z.number().positive(),
    runAtFraction: z.number().gt(0).lt(1),
  }).strict(),
  escalation: z.object({
    onsetRoom: z.number().int().nonnegative(),
    rampPerObstacle: z.number().nonnegative(),
  }).strict(),
  obstacleHeat: z.object({
    safe: z.number().nonnegative(),
    greedy: z.number().nonnegative(),
    greedyBelowFraction: z.number().gt(0).lt(1),
  }).strict(),
  outcomeHeat: z.object({
    clean: z.number().nonnegative(),
    complication: z.number().nonnegative(),
    botched: z.number().nonnegative(),
  }).strict(),
  outcomeLoot: z.object({
    complication: z.number().nonnegative(),
    botched: z.number().nonnegative(),
  }).strict(),
  scenarioSwing: z.object({
    small: z.number().positive(),
    big: z.number().positive(),
  }).strict(),
  getaway: z.object({
    exponent: z.number().positive(),
    skillTerm: z.number().positive(),
    skillPivot: z.number().gt(0).lt(1),
    headcountTerm: z.number().positive(),
    clamp: z.tuple([z.number(), z.number()]),
    brief: z.object({
      lowHeat: z.object({
        heat: z.number().nonnegative(),
        targetCards: z.number().int().positive(),
        timerSeconds: z.number().int().positive(),
      }).strict(),
      highHeat: z.object({
        heat: z.number().nonnegative(),
        targetCards: z.number().int().positive(),
        timerSeconds: z.number().int().positive(),
      }).strict(),
    }).strict(),
    ditchHeatCost: z.number().int().positive(),
    buySecondsBonus: z.number().int().positive(),
  }).strict(),
  scoring: z.object({
    winBaseMultiplier: z.number().positive(),
    lowHeatStyleBonus: z.number().nonnegative(),
    bustMultiplier: z.number().gt(0).lt(1),
  }).strict(),
  generation: z.object({
    obstacleRatio: z.number().gt(0).lt(1),
  }).strict(),
  scenario: z.object({
    dcClamp: z.tuple([z.number().int().min(1), z.number().int().max(20)]),
    easeDialSteps: z.number().int().nonnegative(),
    critFumble: z.boolean(),
    heatDC: z.object({ perHeat: z.number(), perRoom: z.number() }).strict(),
  }).strict(),
  rewardScale: z.object({ perHeat: z.number(), perRoom: z.number() }).strict(),
  gearSellValue: z.object({
    base: z.number().nonnegative(),
    perRoom: z.number().nonnegative(),
  }).strict(),
}).strict();

export type ParsedTuning = z.infer<typeof tuningSchema>;
