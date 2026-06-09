import type { Outcome } from '@/engine';
import type { BoostHook } from '@/minigames/contract';
import type { InsideKnowledgeParams } from './generate';

export type AnswerStatus = 'unanswered' | 'correct' | 'wrong';

export interface InsideKnowledgeState {
  /** Per-question GM-marked result. Length matches params.questions. */
  answers: AnswerStatus[];
  /** True once the countdown timer expires. */
  timerExpired: boolean;
  /** True after the Narrow It Down (Charm) boost fires. */
  charmBoostUsed: boolean;
  /** Index of the question for which Narrow It Down revealed options, or -1 if unused. */
  narrowItDownIndex: number;
}

/**
 * Suggest an outcome for Inside Knowledge (App-assist, MINIGAMES.md §5):
 *   clean        — correctCount >= threshold, timer not expired
 *   complication — correctCount >= threshold, timer expired (at the buzzer)
 *   botched      — correctCount < threshold
 *
 * Unanswered questions count as wrong for the suggestion.
 */
export function judge(state: InsideKnowledgeState, params: InsideKnowledgeParams): Outcome {
  const correctCount = state.answers.filter(a => a === 'correct').length;
  if (correctCount >= params.threshold) {
    return state.timerExpired ? 'complication' : 'clean';
  }
  return 'botched';
}

/** Returns the index of the first unanswered question, or -1 if all answered. */
function firstUnansweredIndex(state: InsideKnowledgeState): number {
  return state.answers.findIndex(a => a === 'unanswered');
}

/** Charm boost: Narrow It Down — reveal multiple-choice options on the current question. Once per game. */
export const narrowItDownBoost: BoostHook<InsideKnowledgeState, InsideKnowledgeParams> = {
  lane: 'charm',
  label: 'Narrow It Down',
  apply(state): InsideKnowledgeState {
    if (state.charmBoostUsed) return state;
    const idx = firstUnansweredIndex(state);
    return { ...state, charmBoostUsed: true, narrowItDownIndex: idx };
  },
};
