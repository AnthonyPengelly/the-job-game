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
  fullTeam: z.boolean().optional(),
}).strict();

export const roomTemplatesSchema = z.object({
  _meta: roomTemplatesPackMetaSchema,
  obstacles: z.array(obstacleTemplateSchema).min(1),
}).strict();

export type ParsedRoomTemplates = z.infer<typeof roomTemplatesSchema>;
