import { z } from 'zod';

export const SETTINGS_VERSION = 1;

export const diceModeSchema = z.enum(['app', 'physical']);
export type DiceMode = z.infer<typeof diceModeSchema>;

export const settingsSchema = z.object({
  version: z.number().int().positive(),
  diceMode: diceModeSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  diceMode: 'app',
};
