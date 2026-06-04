import { z } from 'zod';

export const metaSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  contentVersion: z.string(),
  description: z.string(),
  extends: z.string().nullable(),
  assert: z.enum(['on', 'off']),
  contentPacks: z.record(z.string(), z.string()),
  units: z.record(z.string(), z.string()).optional(),
  _note: z.string().optional(),
}).strict();

export type ParsedMeta = z.infer<typeof metaSchema>;
