import { describe, it, expect } from 'vitest';
import { triviaBankSchema, triviaTierSchema } from './bank';

import triviaJson from '../../../presets/default/content/banks/trivia.json';

const bank = triviaBankSchema.parse(triviaJson);

// ── Schema validation ─────────────────────────────────────────────────────────

describe('trivia bank — schema', () => {
  it('parses without throwing', () => {
    expect(() => triviaBankSchema.parse(triviaJson)).not.toThrow();
  });

  it('has id "trivia" and kind "trivia"', () => {
    expect(bank.id).toBe('trivia');
    expect(bank.kind).toBe('trivia');
  });
});

// ── Size pin ──────────────────────────────────────────────────────────────────
// Playtest feedback: the question pool was too small and repeated at the table.
// Pin the bank size so it can only grow.

describe('trivia bank — size pin', () => {
  it('has at least 100 items', () => {
    expect(bank.items.length).toBeGreaterThanOrEqual(100);
  });

  for (const tier of triviaTierSchema.options) {
    it(`tier "${tier}" has at least 15 items`, () => {
      const count = bank.items.filter((item) => item.tier === tier).length;
      expect(count).toBeGreaterThanOrEqual(15);
    });
  }
});

// ── Item integrity ────────────────────────────────────────────────────────────

describe('trivia bank — item integrity', () => {
  it('every question is unique', () => {
    const questions = bank.items.map((item) => item.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it('every item has exactly 4 options', () => {
    for (const item of bank.items) {
      expect(item.options, item.question).toHaveLength(4);
    }
  });

  it("every item's options include the exact answer (the referee screen marks it via indexOf)", () => {
    for (const item of bank.items) {
      expect(item.options, item.question).toContain(item.answer);
    }
  });

  it('options within an item are unique', () => {
    for (const item of bank.items) {
      const opts = item.options ?? [];
      expect(new Set(opts).size, item.question).toBe(opts.length);
    }
  });
});
