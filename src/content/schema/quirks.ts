import { z } from 'zod';

const laneSchema = z.enum(['tech', 'physical', 'charm', 'stealth']);

const quirkBoostSchema = z
  .object({
    lane: laneSchema,
    magnitude: z.number().int().positive(),
  })
  .strict();

const quirkItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    boosts: z.array(quirkBoostSchema).min(1).max(2),
  })
  .strict()
  .superRefine((val, ctx) => {
    // Empty or >2 boosts are caught by .min(1).max(2) above; guard here in case
    // Zod runs superRefine in DIRTY mode.
    if (val.boosts.length === 0 || val.boosts.length > 2) return;

    if (val.boosts.length === 1) {
      if (val.boosts[0]!.magnitude !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Single-lane quirk must have magnitude 2',
        });
      }
    } else {
      // Two-lane: both magnitude 1, distinct lanes
      if (val.boosts[0]!.magnitude !== 1 || val.boosts[1]!.magnitude !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Two-lane quirk must have magnitude 1 for each boost',
        });
      }
      if (val.boosts[0]!.lane === val.boosts[1]!.lane) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Two-lane quirk must target distinct lanes',
        });
      }
    }
  });

const quirksMetaSchema = z
  .object({
    pack: z.literal('quirks'),
    version: z.number().int().positive(),
    source: z.string(),
  })
  .strict();

export const quirksSchema = z
  .object({
    _meta: quirksMetaSchema,
    items: z.array(quirkItemSchema),
  })
  .strict();

export type ParsedQuirks = z.infer<typeof quirksSchema>;
export type ParsedQuirkItem = z.infer<typeof quirkItemSchema>;
