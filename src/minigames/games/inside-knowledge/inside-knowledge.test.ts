import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import type { TriviaItemConfig } from '@/engine/config';
import { makeGenerate } from './generate';
import { judge, narrowItDownBoost } from './judge';
import type { InsideKnowledgeState, AnswerStatus } from './judge';
import { makeInsideKnowledge } from './index';
import { loadPreset } from '@/platform/presets/load';
import { buildRegistry } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

const TEST_ITEMS: TriviaItemConfig[] = [
  { question: 'What is a PIN?', answer: 'Personal Identification Number', tier: 'easy', options: ['Personal Identification Number', 'Private Internal Node', 'Portable Input', 'Public ID Number'] },
  { question: 'What does CCTV stand for?', answer: 'Closed-Circuit Television', tier: 'easy' },
  { question: 'What is a deadbolt?', answer: 'A type of lock', tier: 'easy', options: ['A type of lock', 'A type of alarm', 'A type of safe', 'A type of camera'] },
  { question: 'What is social engineering?', answer: 'Manipulating people', tier: 'medium', options: ['Manipulating people', 'Network hacking', 'Physical intrusion', 'Password cracking'] },
  { question: 'What is a dead drop?', answer: 'Passing items without meeting', tier: 'medium' },
  { question: 'What is AES?', answer: 'Advanced Encryption Standard', tier: 'hard', options: ['Advanced Encryption Standard', 'Data Encryption Standard', 'RSA', 'SHA-256'] },
  { question: 'What is a zero-day exploit?', answer: 'Attack on unknown vulnerability', tier: 'hard' },
];

const SINGLE_TIER_ITEMS: TriviaItemConfig[] = [
  { question: 'Q1', answer: 'A1', tier: 'medium' },
  { question: 'Q2', answer: 'A2', tier: 'medium' },
  { question: 'Q3', answer: 'A3', tier: 'medium' },
];

// ── Registry ──────────────────────────────────────────────────────────────────

describe('inside-knowledge registry', () => {
  it('buildRegistry with default preset contains insideKnowledge', () => {
    const cfg = loadPreset('default');
    const registry = buildRegistry(cfg);
    expect(registry.find(g => g.id === 'insideKnowledge')).toBeDefined();
  });

  it('makeInsideKnowledge has id insideKnowledge', () => {
    expect(makeInsideKnowledge(TEST_ITEMS).id).toBe('insideKnowledge');
  });

  it('makeInsideKnowledge has lanes tech and charm', () => {
    expect(makeInsideKnowledge(TEST_ITEMS).lanes).toEqual(['tech', 'charm']);
  });

  it('makeInsideKnowledge has minCommit 1', () => {
    expect(makeInsideKnowledge(TEST_ITEMS).minCommit).toBe(1);
  });

  it('makeInsideKnowledge has no soloVariantId', () => {
    expect(makeInsideKnowledge(TEST_ITEMS).soloVariantId).toBeUndefined();
  });

  it('makeInsideKnowledge has one boost hook (Narrow It Down)', () => {
    expect(makeInsideKnowledge(TEST_ITEMS).boosts).toHaveLength(1);
    expect(makeInsideKnowledge(TEST_ITEMS).boosts[0]!.label).toBe('Narrow It Down');
  });
});

// ── Generator reproducibility ─────────────────────────────────────────────────

describe('generate — reproducibility', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const generate = makeGenerate(TEST_ITEMS);
    const p1 = generate(mulberry32(42), dial(0));
    const p2 = generate(mulberry32(42), dial(0));
    expect(p1).toEqual(p2);
  });

  it('different seeds produce different question sets', () => {
    const generate = makeGenerate(TEST_ITEMS);
    const p1 = generate(mulberry32(1), dial(0));
    const p2 = generate(mulberry32(9999), dial(0));
    expect(JSON.stringify(p1.questions)).not.toEqual(JSON.stringify(p2.questions));
  });

  it('questions is a non-empty array', () => {
    const p = makeGenerate(TEST_ITEMS)(mulberry32(42), dial(0));
    expect(p.questions.length).toBeGreaterThan(0);
  });

  it('each question has question, answer, and tier fields', () => {
    const p = makeGenerate(TEST_ITEMS)(mulberry32(42), dial(0));
    for (const q of p.questions) {
      expect(typeof q.question).toBe('string');
      expect(typeof q.answer).toBe('string');
      expect(['easy', 'medium', 'hard']).toContain(q.tier);
    }
  });

  it('threshold is at least ceil(questionCount * 0.6)', () => {
    const p = makeGenerate(TEST_ITEMS)(mulberry32(42), dial(0));
    expect(p.threshold).toBe(Math.ceil(p.questions.length * 0.6));
  });

  it('no repeated questions in a single draw', () => {
    const generate = makeGenerate(TEST_ITEMS);
    for (let seed = 0; seed < 20; seed++) {
      const p = generate(mulberry32(seed), dial(0));
      const questionTexts = p.questions.map(q => q.question);
      const unique = new Set(questionTexts);
      expect(unique.size).toBe(questionTexts.length);
    }
  });
});

// ── Dial lever direction ──────────────────────────────────────────────────────

describe('generate — dial levers (higher dial = harder)', () => {
  it('higher dial ⇒ higher question count', () => {
    const generate = makeGenerate(TEST_ITEMS);
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.questions.length).toBeGreaterThanOrEqual(easy.questions.length);
  });

  it('higher dial ⇒ less time', () => {
    const generate = makeGenerate(TEST_ITEMS);
    const easy = generate(mulberry32(42), dial(-2));
    const hard = generate(mulberry32(42), dial(2));
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('questionCount is always within [2, 7]', () => {
    const generate = makeGenerate(TEST_ITEMS);
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.questions.length).toBeGreaterThanOrEqual(2);
      expect(p.questions.length).toBeLessThanOrEqual(7);
    }
  });

  it('timerSeconds is always within [45, 150]', () => {
    const generate = makeGenerate(TEST_ITEMS);
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.timerSeconds).toBeGreaterThanOrEqual(45);
      expect(p.timerSeconds).toBeLessThanOrEqual(150);
    }
  });

  it('easy dial produces easy tier', () => {
    const p = makeGenerate(TEST_ITEMS)(mulberry32(1), dial(-2));
    expect(p.tier).toBe('easy');
  });

  it('hard dial produces hard tier', () => {
    const p = makeGenerate(TEST_ITEMS)(mulberry32(1), dial(2));
    expect(p.tier).toBe('hard');
  });

  it('mid dial produces medium tier', () => {
    const p = makeGenerate(TEST_ITEMS)(mulberry32(1), dial(0));
    expect(p.tier).toBe('medium');
  });
});

// ── Tier fallback ─────────────────────────────────────────────────────────────

describe('generate — tier fallback', () => {
  it('falls back to all items when filtered tier pool is too small', () => {
    const generate = makeGenerate(SINGLE_TIER_ITEMS);
    const p = generate(mulberry32(1), dial(-2));
    expect(p.questions.length).toBeGreaterThan(0);
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<InsideKnowledgeState> = {}): InsideKnowledgeState {
  return {
    answers: ['unanswered', 'unanswered', 'unanswered', 'unanswered'] as AnswerStatus[],
    timerExpired: false,
    charmBoostUsed: false,
    narrowItDownIndex: -1,
    ...overrides,
  };
}

const baseParams = {
  questions: [
    { question: 'Q1', answer: 'A1', tier: 'easy' as const },
    { question: 'Q2', answer: 'A2', tier: 'easy' as const },
    { question: 'Q3', answer: 'A3', tier: 'easy' as const },
    { question: 'Q4', answer: 'A4', tier: 'easy' as const },
  ],
  tier: 'easy' as const,
  threshold: 3,
  timerSeconds: 90,
};

describe('judge', () => {
  it('botched when not enough correct regardless of timer', () => {
    expect(judge(makeState({ answers: ['correct', 'wrong', 'wrong', 'wrong'] }), baseParams)).toBe('botched');
    expect(judge(makeState({ answers: ['correct', 'correct', 'wrong', 'wrong'] }), baseParams)).toBe('botched');
    expect(judge(makeState({ answers: ['unanswered', 'unanswered', 'unanswered', 'unanswered'] }), baseParams)).toBe('botched');
  });

  it('botched when not enough correct and timer expired', () => {
    expect(judge(makeState({ answers: ['correct', 'wrong', 'wrong', 'wrong'], timerExpired: true }), baseParams)).toBe('botched');
  });

  it('clean when enough correct and timer has not expired', () => {
    expect(judge(makeState({ answers: ['correct', 'correct', 'correct', 'wrong'] }), baseParams)).toBe('clean');
    expect(judge(makeState({ answers: ['correct', 'correct', 'correct', 'correct'] }), baseParams)).toBe('clean');
  });

  it('complication when enough correct and timer expired (at the buzzer)', () => {
    expect(judge(makeState({ answers: ['correct', 'correct', 'correct', 'wrong'], timerExpired: true }), baseParams)).toBe('complication');
    expect(judge(makeState({ answers: ['correct', 'correct', 'correct', 'correct'], timerExpired: true }), baseParams)).toBe('complication');
  });
});

// ── boost hooks ───────────────────────────────────────────────────────────────

describe('narrowItDownBoost', () => {
  it('has lane charm', () => {
    expect(narrowItDownBoost.lane).toBe('charm');
  });

  it('has label Narrow It Down', () => {
    expect(narrowItDownBoost.label).toBe('Narrow It Down');
  });

  it('sets charmBoostUsed and records the current question index on first use', () => {
    const state = makeState({ answers: ['correct', 'unanswered', 'unanswered', 'wrong'] });
    const next = narrowItDownBoost.apply(state, baseParams);
    expect(next.charmBoostUsed).toBe(true);
    expect(next.narrowItDownIndex).toBe(1);
  });

  it('is idempotent — same reference returned when already used', () => {
    const state = makeState({ charmBoostUsed: true, narrowItDownIndex: 1 });
    const next = narrowItDownBoost.apply(state, baseParams);
    expect(next).toBe(state);
  });

  it('records -1 when all questions are already answered', () => {
    const state = makeState({ answers: ['correct', 'wrong', 'correct', 'wrong'], charmBoostUsed: false });
    const next = narrowItDownBoost.apply(state, baseParams);
    expect(next.charmBoostUsed).toBe(true);
    expect(next.narrowItDownIndex).toBe(-1);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    narrowItDownBoost.apply(state, baseParams);
    expect(JSON.stringify(state)).toBe(before);
  });
});
