import { z } from 'zod';

const roomTemplatesPackMetaSchema = z.object({
  pack: z.literal('roomTemplates'),
  version: z.number().int().positive(),
  source: z.string(),
}).strict();

const obstacleOptionSchema = z.object({
  id: z.string().min(1),
  greedy: z.boolean(),
  heatCost: z.number().int().nonnegative(),
  reward: z.number().int().nonnegative(),
}).strict();

const obstacleTemplateSchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  lane: z.enum(['tech', 'physical', 'charm', 'stealth']),
  options: z.tuple([obstacleOptionSchema, obstacleOptionSchema]).refine(
    ([a, b]) => !a.greedy && b.greedy,
    { message: 'options must be [safe, greedy] — first greedy:false, second greedy:true' },
  ),
}).strict();

// ── Scenario content model (E7.1) ─────────────────────────────────────────────

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
// Use z.lazy with z.ZodTypeAny to avoid exactOptionalPropertyTypes conflicts.
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

// A choice is either { effect } (no roll) or { roll } — structural discrimination.
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

export const roomTemplatesSchema = z.object({
  _meta: roomTemplatesPackMetaSchema,
  obstacles: z.array(obstacleTemplateSchema).min(1),
  scenarios: z.array(scenarioDefSchema).min(1),
}).strict();

export type ParsedRoomTemplates = z.infer<typeof roomTemplatesSchema>;
