import { z } from 'zod';
import type { MansionType, Lane, Outcome } from '@/engine';
import { ALLOWED_TOKENS } from '../narration/template';

// ── When condition ────────────────────────────────────────────────────────────

// Zod enums are written out as literals; the TypeScript types are imported from
// @/engine as type-only imports so the content layer stays below the engine.
export const narrationWhenSchema = z
  .object({
    mansionType: z.enum(['villa', 'estate', 'penthouse'] satisfies [MansionType, ...MansionType[]]).optional(),
    /** GameId as a plain string — branded at the engine layer, JSON carries no brand. */
    gameId: z.string().optional(),
    lane: z.enum(['tech', 'physical', 'charm', 'stealth'] satisfies [Lane, ...Lane[]]).optional(),
    outcome: z.enum(['clean', 'complication', 'botched'] satisfies [Outcome, ...Outcome[]]).optional(),
    greedy: z.boolean().optional(),
    heatBand: z.enum(['cool', 'warm', 'hot']).optional(),
  })
  .strict();

export type NarrationWhen = z.infer<typeof narrationWhenSchema>;

// ── Variant ───────────────────────────────────────────────────────────────────

export const narrationVariantSchema = z
  .object({
    id: z.string().min(1),
    /**
     * One teleprompter line, or a sequence the GM steps through with "Next".
     * Sequences let a single beat walk the table through a whole moment
     * (vibe line → what happens → what to do) instead of one bitty quip.
     */
    text: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    when: narrationWhenSchema.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const lines = typeof v.text === 'string' ? [v.text] : v.text;
    const re = /\{(\w+)\}/g;
    for (const line of lines) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        const token = m[1]!;
        if (!(ALLOWED_TOKENS as readonly string[]).includes(token)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown template token "{${token}}" in variant "${v.id}"`,
          });
        }
      }
    }
  });

export type NarrationVariant = z.infer<typeof narrationVariantSchema>;

// ── Beat (array with unique-id enforcement) ───────────────────────────────────

const beatSchema = z.array(narrationVariantSchema).superRefine((variants, ctx) => {
  const seen = new Set<string>();
  for (const v of variants) {
    if (seen.has(v.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate variant id: "${v.id}"`,
      });
    }
    seen.add(v.id);
  }
});

// ── Narration bank ────────────────────────────────────────────────────────────

export const narrationSchema = z
  .object({
    briefing: beatSchema,
    roomApproach: beatSchema,
    obstacleClue: beatSchema,
    optionDescription: beatSchema,
    pushRun: beatSchema,
    outcomeQuip: beatSchema,
    scenarioSetup: beatSchema,
    scenarioReveal: beatSchema,
    getawayIntro: beatSchema,
    getawayCountdown: beatSchema,
    winSting: beatSchema,
    bustSting: beatSchema,
  })
  .strict();

export type ParsedNarration = z.infer<typeof narrationSchema>;

/** All valid beat names in the narration bank. */
export type NarrationBeat = keyof ParsedNarration;
