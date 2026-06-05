import { z } from 'zod';

const idleSliceSchema = z.object({ kind: z.literal('idle') });

const defuseRulebookSliceSchema = z.object({
  kind: z.literal('defuse-rulebook'),
  /** Human-readable cut rules, e.g. ["Cut RED wires", "Cut CIRCLE wires"]. */
  rules: z.array(z.string()),
  /** True when the game is active and the rulebook is in use. */
  gameActive: z.boolean(),
});

/**
 * Zod-validated, read-only slice sent one-way from the console to the player-view.
 * Contains ONLY player-safe data — never GM-only state (wire layout, safe/unsafe mapping, etc.).
 * Extra keys are stripped on parse (isolation enforced by the type, not memory).
 */
export const playerViewSliceSchema = z.discriminatedUnion('kind', [
  idleSliceSchema,
  defuseRulebookSliceSchema,
]);

export type PlayerViewSlice = z.infer<typeof playerViewSliceSchema>;
export type DefuseRulebookSlice = z.infer<typeof defuseRulebookSliceSchema>;
