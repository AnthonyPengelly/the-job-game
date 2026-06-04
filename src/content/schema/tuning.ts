import { z } from 'zod';

const tuningPackMetaSchema = z.object({
  pack: z.literal('tuning'),
  version: z.number().int().positive(),
  source: z.string(),
  units: z.record(z.string(), z.string()),
});

export const tuningSchema = z.object({
  _meta: tuningPackMetaSchema,
  heat: z.object({
    hMax: z.number().positive(),
    runAtFraction: z.number().gt(0).lt(1),
  }),
  escalation: z.object({
    onsetRoom: z.number().int().nonnegative(),
    rampPerObstacle: z.number().nonnegative(),
  }),
  obstacleHeat: z.object({
    safe: z.number().nonnegative(),
    greedy: z.number().nonnegative(),
    greedyBelowFraction: z.number().gt(0).lt(1),
  }),
  outcomeHeat: z.object({
    clean: z.number().nonnegative(),
    complication: z.number().nonnegative(),
    botched: z.number().nonnegative(),
  }),
  scenarioSwing: z.object({
    small: z.number().positive(),
    big: z.number().positive(),
  }),
  getaway: z.object({
    exponent: z.number().positive(),
    skillTerm: z.number().positive(),
    skillPivot: z.number().gt(0).lt(1),
    headcountTerm: z.number().positive(),
    clamp: z.tuple([z.number(), z.number()]),
  }),
  scoring: z.object({
    winBaseMultiplier: z.number().positive(),
    lowHeatStyleBonus: z.number().nonnegative(),
    bustMultiplier: z.number().gt(0).lt(1),
  }),
});

export type ParsedTuning = z.infer<typeof tuningSchema>;
