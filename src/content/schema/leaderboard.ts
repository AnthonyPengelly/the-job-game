import { z } from 'zod';

export const LEADERBOARD_VERSION = 1;

export const leaderboardEntrySchema = z.object({
  runSeed: z.number().int().nonnegative(),
  score: z.number(),
  loot: z.number().int().nonnegative(),
  heatAtGetaway: z.number().int().nonnegative(),
  win: z.boolean(),
  crewSize: z.number().int().min(1).max(7),
  /** Unix timestamp (ms) when the run was recorded. */
  finishedAt: z.number().int().nonnegative(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardEnvelopeSchema = z.object({
  version: z.number().int().positive(),
  entries: z.array(leaderboardEntrySchema),
});

export type LeaderboardEnvelope = z.infer<typeof leaderboardEnvelopeSchema>;
