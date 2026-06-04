import { z } from 'zod';

const scalingPackMetaSchema = z.object({
  pack: z.literal('scaling'),
  version: z.number().int().positive(),
  source: z.string(),
  units: z.record(z.string(), z.string()),
});

const profileSchema = z.object({
  exhaustion: z.enum(['full', 'light', 'tired']),
  crewPerOption: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  getawayBonus: z.number(),
});

const variantEntrySchema = z.object({
  soloVariantId: z.string().optional(),
  variantId: z.string().optional(),
  appliesAt: z.array(z.number().int().positive()),
});

const dialCurveEntrySchema = z.object({
  base: z.number(),
  perLanePoint: z.number(),
  tightenPerExtraCrew: z.number(),
});

export const scalingSchema = z.object({
  _meta: scalingPackMetaSchema,
  profiles: z.record(z.string(), profileSchema),
  minCommit: z.record(z.string(), z.number().int().positive()),
  variant: z.record(z.string(), variantEntrySchema),
  excludedFromSolo: z.array(z.string()),
  soloEligibleMinPool: z.number().int().positive(),
  dialCurve: z.record(z.string(), dialCurveEntrySchema),
});

export type ParsedScaling = z.infer<typeof scalingSchema>;
