import { z } from 'zod';
import type { MansionType } from '@/engine';

export const markSpineSchema = z
  .object({
    id: z.string().min(1),
    mansionType: z.enum(['villa', 'estate', 'penthouse'] satisfies [MansionType, ...MansionType[]]),
    markName: z.string().min(1),
    vault: z.string().min(1),
    security: z.string().min(1),
    targetHaul: z.string().min(1),
    dropCaption: z.string().min(1),
    dressing: z.string().min(1),
  })
  .strict();

export type MarkSpine = z.infer<typeof markSpineSchema>;

export const spineBankSchema = z
  .object({
    marks: z.array(markSpineSchema).superRefine((marks, ctx) => {
      const seen = new Set<string>();
      for (const m of marks) {
        if (seen.has(m.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate mark id: "${m.id}"`,
          });
        }
        seen.add(m.id);
      }
    }),
  })
  .strict();

export type SpineBank = z.infer<typeof spineBankSchema>;
