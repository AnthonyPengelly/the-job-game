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
    /** Thematic heist name shown on share-out cards and the gear panel. */
    name: z.string().min(1),
    /** One-line flavour read out by the GM. */
    blurb: z.string().min(1),
  })
  .strict();

const powerUpItemSchema = z
  .object({
    id: z.string(),
    kind: z.literal('powerUp'),
    lane: laneSchema,
    name: z.string().min(1),
    blurb: z.string().min(1),
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
