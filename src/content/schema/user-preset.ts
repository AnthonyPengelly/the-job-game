import { z } from 'zod';
import { tuningSchema } from './tuning';

// User presets edit tuning only; scaling, content packs, and banks are
// inherited from the bundled 'default' bundle. The panel edits Heat, Getaway,
// and scoring constants — all fields in tuning.json.
export const userPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseId: z.literal('default'),
  tuning: tuningSchema,
});

export type UserPreset = z.infer<typeof userPresetSchema>;
