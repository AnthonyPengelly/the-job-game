import { z } from 'zod';

const scalingPackMetaSchema = z.object({
  pack: z.literal('scaling'),
  version: z.number().int().positive(),
  source: z.string(),
  units: z.record(z.string(), z.string()),
}).strict();

const profileSchema = z.object({
  exhaustion: z.enum(['full', 'light', 'tired']),
  crewPerOption: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  getawayBonus: z.number(),
}).strict();

const variantEntrySchema = z.object({
  soloVariantId: z.string().optional(),
  variantId: z.string().optional(),
  appliesAt: z.array(z.number().int().positive()),
}).strict();

const dialCurveEntrySchema = z.object({
  base: z.number(),
  perLanePoint: z.number(),
  tightenPerExtraCrew: z.number(),
}).strict();

const exhaustionRestSchema = z.object({
  full: z.number().int().nonnegative(),
  light: z.number().int().nonnegative(),
  tired: z.number().int().nonnegative(),
}).strict();

export const scalingSchema = z.object({
  _meta: scalingPackMetaSchema,
  profiles: z.record(z.string(), profileSchema),
  exhaustionRest: exhaustionRestSchema,
  minCommit: z.record(z.string(), z.number().int().positive()),
  variant: z.record(z.string(), variantEntrySchema),
  excludedFromSolo: z.array(z.string()),
  soloEligibleMinPool: z.number().int().positive(),
  dialCurve: z.record(z.string(), dialCurveEntrySchema),
}).strict();

export type ParsedScaling = z.infer<typeof scalingSchema>;
