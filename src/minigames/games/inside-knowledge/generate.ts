import type { Rng } from '@/engine';
import type { TriviaItemConfig } from '@/engine/config';
import type { Difficulty } from '@/minigames/contract';

export type TriviaTier = 'easy' | 'medium' | 'hard';

export interface TriviaQuestion {
  question: string;
  answer: string;
  tier: TriviaTier;
  options?: string[];
}

export interface InsideKnowledgeParams {
  /** Questions drawn from the bank for this challenge. */
  questions: TriviaQuestion[];
  /** Difficulty tier selected for this challenge. */
  tier: TriviaTier;
  /** Number of correct answers needed to avoid botching. */
  threshold: number;
  /** Countdown timer length in seconds. */
  timerSeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Fisher-Yates shuffle using the seeded RNG. Returns a new array. */
function shuffled<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/**
 * Factory that binds the trivia item bank to a generate function.
 *
 * Dial levers (lower dial.level = easier):
 *   - tier pool: easy ⇒ draw from easy+medium; medium ⇒ medium; hard ⇒ hard.
 *     Wave 4: the easy band is more available and mixes easy with medium
 *     questions rather than pure easy.
 *   - questionCount: fewer questions at lower dial (2..7)
 *   - timerSeconds: more time at lower dial (45..150 s)
 *   - threshold: ALWAYS questionCount − 1 (one mistake allowed, wave 4).
 *
 * Questions are drawn without repetition (Fisher-Yates on the tier-filtered
 * pool). If fewer items exist than questionCount, the pool widens to all
 * items. Same seed + same dial => same question set.
 */
export function makeGenerate(items: TriviaItemConfig[]) {
  return function generate(rng: Rng, dial: Difficulty): InsideKnowledgeParams {
    // Band label (shown to the GM) + the tier pool questions are drawn from.
    const tier: TriviaTier = dial.level < 0.5 ? 'easy' : dial.level < 1.5 ? 'medium' : 'hard';
    const allowedTiers: TriviaTier[] =
      tier === 'easy' ? ['easy', 'medium'] : tier === 'medium' ? ['medium'] : ['hard'];

    const questionCount = clamp(Math.round(4 + dial.level), 2, 7);
    const timerSeconds = clamp(Math.round(90 - dial.level * 15), 45, 150);

    const tieredItems = items.filter(i => allowedTiers.includes(i.tier as TriviaTier));
    // Fallback: if the filtered pool is too small, widen to all items
    const pool = tieredItems.length >= questionCount ? tieredItems : items;
    const shuffledPool = shuffled(pool, rng);
    const selected = shuffledPool.slice(0, Math.min(questionCount, shuffledPool.length));

    // One mistake allowed: need all-but-one right (floored at 1).
    const threshold = Math.max(1, selected.length - 1);

    return {
      questions: selected.map(q => ({
        question: q.question,
        answer: q.answer,
        tier: q.tier as TriviaTier,
        ...(q.options !== undefined ? { options: q.options } : {}),
      })),
      tier,
      threshold,
      timerSeconds,
    };
  };
}
