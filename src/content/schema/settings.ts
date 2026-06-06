import { z } from 'zod';

export const SETTINGS_VERSION = 2;

export const diceModeSchema = z.enum(['app', 'physical']);
export type DiceMode = z.infer<typeof diceModeSchema>;

export const settingsSchema = z.object({
  version: z.number().int().positive(),
  diceMode: diceModeSchema,
  // Default applied during migration from v1: old saves without this field load
  // as 'default' (the built-in preset) rather than being reset to defaults.
  activePresetId: z.string().default('default'),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  diceMode: 'app',
  activePresetId: 'default',
};
