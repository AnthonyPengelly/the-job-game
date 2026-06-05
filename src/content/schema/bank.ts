import { z } from 'zod';

/** Base schema satisfied by every content bank — id, kind, and a non-empty items array. */
export const bankSchema = z.object({
  id: z.string(),
  kind: z.string(),
  items: z.array(z.unknown()).min(1),
});

export type Bank = z.infer<typeof bankSchema>;

/** Strict schema for the categories bank — items are plain strings. */
export const categoriesBankSchema = z.object({
  id: z.string(),
  kind: z.literal('categories'),
  items: z.array(z.string()).min(1),
});

export type CategoriesBank = z.infer<typeof categoriesBankSchema>;
