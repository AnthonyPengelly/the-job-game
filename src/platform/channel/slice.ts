import { z } from 'zod';

const idleSliceSchema = z.object({ kind: z.literal('idle') });

const defuseRulebookSliceSchema = z.object({
  kind: z.literal('defuse-rulebook'),
  /** Human-readable cut rules, e.g. ["Cut RED wires", "Cut CIRCLE wires"]. */
  rules: z.array(z.string()),
  /** True when the game is active and the rulebook is in use. */
  gameActive: z.boolean(),
});

const getawaySliceSchema = z.object({
  kind: z.literal('getaway'),
  /** Number of cards cleared so far. */
  cardsCleared: z.number().int().nonnegative(),
  /** Total cards needed to escape. */
  targetCards: z.number().int().positive(),
  /** Seconds remaining on the countdown. */
  secondsRemaining: z.number().nonnegative(),
  /** Display name of the current clue-giver. */
  clueGiverName: z.string(),
  /** Zero-based index of the current clue-giver in the crew array. */
  clueGiverIndex: z.number().int().nonnegative(),
  /** True when the game is active (timer has been started). */
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
  getawaySliceSchema,
]);

export type PlayerViewSlice = z.infer<typeof playerViewSliceSchema>;
export type DefuseRulebookSlice = z.infer<typeof defuseRulebookSliceSchema>;
export type GetawaySlice = z.infer<typeof getawaySliceSchema>;
