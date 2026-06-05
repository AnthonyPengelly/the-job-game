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

/** Difficulty tier for trivia questions. */
export const triviaTierSchema = z.enum(['easy', 'medium', 'hard']);
export type TriviaTier = z.infer<typeof triviaTierSchema>;

/** A single trivia question with answer and optional multiple-choice options. */
export const triviaItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  tier: triviaTierSchema,
  options: z.array(z.string().min(1)).min(2).optional(),
});

export type TriviaItem = z.infer<typeof triviaItemSchema>;

/** Strict schema for the trivia bank — items are TriviaItem objects. */
export const triviaBankSchema = z.object({
  id: z.string(),
  kind: z.literal('trivia'),
  items: z.array(triviaItemSchema).min(1),
});

export type TriviaBank = z.infer<typeof triviaBankSchema>;
