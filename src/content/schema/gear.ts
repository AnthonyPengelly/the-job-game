import { z } from 'zod';

const gearPackMetaSchema = z
  .object({
    pack: z.literal('gear'),
    version: z.number().int().positive(),
    source: z.string(),
    units: z.record(z.string(), z.string()),
  })
  .strict();

const laneSchema = z.enum(['tech', 'physical', 'charm', 'stealth']);

const statBoostItemSchema = z
  .object({
    id: z.string(),
    kind: z.literal('statBoost'),
    lane: laneSchema,
    magnitude: z.number().int().positive(),
    flavour: z.array(z.string()).optional(),
  })
  .strict();

const powerUpItemSchema = z
  .object({
    id: z.string(),
    kind: z.literal('powerUp'),
    lane: laneSchema,
    flavour: z.array(z.string()).optional(),
  })
  .strict();

const gearItemSchema = z.discriminatedUnion('kind', [statBoostItemSchema, powerUpItemSchema]);

export const gearSchema = z
  .object({
    _meta: gearPackMetaSchema,
    items: z.array(gearItemSchema),
  })
  .strict();

export type ParsedGear = z.infer<typeof gearSchema>;
export type ParsedGearItem = z.infer<typeof gearItemSchema>;
