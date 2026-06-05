import { z } from 'zod';

const scenariosPackMetaSchema = z.object({
  pack: z.literal('scenarios'),
  version: z.number().int().positive(),
  source: z.string(),
}).strict();

const laneSchema = z.enum(['tech', 'physical', 'charm', 'stealth']);

const gearGrantDescriptorSchema = z.object({
  kind: z.enum(['statBoost', 'powerUp', 'bigScore']),
  lane: laneSchema.optional(),
  lanes: z.array(laneSchema).min(1).optional(),
}).strict().refine(
  d => d.lane !== undefined || (d.lanes !== undefined && d.lanes.length > 0),
  { message: 'GearGrantDescriptor must specify lane or lanes' },
);

// Scenario effects are recursive (delayed payoff contains a nested effect).
const scenarioEffectSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    heatDelta: z.number().int(),
    lootDelta: z.number().int(),
    gear: gearGrantDescriptorSchema.optional(),
    info: z.boolean().optional(),
    delayed: z.object({
      kind: z.string().min(1),
      roomsLeft: z.number().int().positive(),
      payoff: scenarioEffectSchema,
    }).strict().optional(),
  }).strict(),
);

const scenarioRollSpecSchema = z.object({
  lane: laneSchema,
  baseDifficulty: z.number().int().min(1).max(20),
  success: scenarioEffectSchema,
  failure: scenarioEffectSchema,
}).strict();

const scenarioChoiceDefSchema = z.union([
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    effect: scenarioEffectSchema,
  }).strict(),
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    roll: scenarioRollSpecSchema,
  }).strict(),
]);

const scenarioDefSchema = z.object({
  id: z.string().min(1),
  setup: z.string().min(1),
  choices: z.tuple([scenarioChoiceDefSchema, scenarioChoiceDefSchema]),
}).strict();

export const scenariosSchema = z.object({
  _meta: scenariosPackMetaSchema,
  items: z.array(scenarioDefSchema).min(1),
}).strict();

export type ParsedScenarios = z.infer<typeof scenariosSchema>;
export type ParsedScenarioDef = z.infer<typeof scenarioDefSchema>;
