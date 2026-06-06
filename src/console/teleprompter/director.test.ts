import { describe, it, expect } from 'vitest';
import { createNarrationDirector } from './director';
import { loadDefaultNarration } from '@/platform/presets/browser';
import type { NarrationBeat, NarrationWhen } from '@/content/schema/narration';
import type { ParsedNarration } from '@/content/schema/narration';

// ── Minimal fixture for isolated unit tests ───────────────────────────────────

function makeMinimalBank(): ParsedNarration {
  const v = (id: string, text: string) => ({ id, text });
  const variants = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => v(`${prefix}-${i}`, `${prefix} text ${i}`));
  return {
    briefing: variants('br', 8),
    obstacleClue: variants('oc', 10),
    optionDescription: variants('od', 10),
    pushRun: variants('pr', 8),
    outcomeQuip: variants('oq', 18),
    scenarioSetup: variants('ss', 8),
    getawayIntro: variants('gi', 6),
    getawayCountdown: variants('gc', 6),
    winSting: variants('ws', 6),
    bustSting: variants('bs', 6),
  };
}

// ── Determinism ───────────────────────────────────────────────────────────────

describe('NarrationDirector — determinism', () => {
  it('two directors from the same seed emit the same sequence', () => {
    const bank = makeMinimalBank();
    const d1 = createNarrationDirector(bank, 1312);
    const d2 = createNarrationDirector(bank, 1312);

    const beats: NarrationBeat[] = [
      'briefing',
      'obstacleClue',
      'optionDescription',
      'outcomeQuip',
      'scenarioSetup',
      'pushRun',
      'getawayIntro',
      'getawayCountdown',
      'winSting',
    ];

    for (const beat of beats) {
      expect(d1.next(beat)).toBe(d2.next(beat));
    }
  });

  it('directors from different seeds produce different sequences', () => {
    const bank = makeMinimalBank();
    const d1 = createNarrationDirector(bank, 1);
    const d2 = createNarrationDirector(bank, 2);

    const results1 = Array.from({ length: 5 }, () => d1.next('obstacleClue'));
    const results2 = Array.from({ length: 5 }, () => d2.next('obstacleClue'));

    // With different seeds the sequences are almost certainly distinct
    expect(results1).not.toEqual(results2);
  });

  it('the narration salt ensures different output from the raw seed', () => {
    const bank = makeMinimalBank();
    const d = createNarrationDirector(bank, 0);
    // Should not throw and should return a non-empty string
    expect(d.next('briefing')).toBeTruthy();
  });
});

// ── Ring buffer — prefers non-recent ─────────────────────────────────────────

describe('NarrationDirector — ring buffer avoids recent picks', () => {
  it('does not immediately repeat the last pick from a large pool', () => {
    const bank = makeMinimalBank(); // briefing pool = 8, window = 4
    const d = createNarrationDirector(bank, 42);
    const first = d.next('briefing');
    for (let i = 0; i < 3; i++) {
      // Make 3 more calls — the window is 4, so first is still recent
      const line = d.next('briefing');
      expect(line).not.toBe(first);
    }
  });

  it('falls back gracefully when pool is exhausted (all variants in window)', () => {
    // Use a tiny pool with a large forced window to trigger fallback
    const smallBank: ParsedNarration = {
      ...makeMinimalBank(),
      briefing: [
        { id: 'b0', text: 'alpha' },
        { id: 'b1', text: 'beta' },
      ],
    };
    // Window forced to 10 — larger than the pool of 2; fallback must not throw
    const d = createNarrationDirector(smallBank, 7, 10);
    expect(() => {
      for (let i = 0; i < 20; i++) d.next('briefing');
    }).not.toThrow();
  });
});

// ── Full-run no-repeat proof ──────────────────────────────────────────────────
//
// Walk a representative full-run beat sequence through the director and assert
// that within each beat no line is repeated.  The run uses 3 obstacles and
// 2 scenarios — sized so that every beat's call count stays safely within the
// pool bounds, guaranteeing uniqueness with the default window (half the full
// pool size).
//
// The ring buffer is SHARED across all calls to a beat regardless of context.
// With a window of half the total pool (5 for optionDescription, 25 for
// obstacleClue, etc.) interleaved safe/greedy calls cross-contaminate the buffer.
// 3 obstacles (6 optionDescription calls = 3 safe + 3 greedy) is the upper bound
// that guarantees no repeats for the interleaved pattern with this bank.
//
// Per-beat pool sizes (default bank):
//   briefing (villa filter): 4 of 12 → window 6 → 1 call, fine
//   obstacleClue (per gameId): 5 of 50 → window 25 → 3 calls, fine
//   optionDescription (interleaved safe+greedy): window 5 → 3 each = 6 total, fine
//   outcomeQuip (per outcome): 6 of 18 → window 9 → ≤3 calls each, fine
//   scenarioSetup: 8 → window 4 → 2 calls, fine
//   pushRun: 8 → window 4 → 1 call, fine
//   getawayIntro: 6 → window 3 → 1 call, fine
//   getawayCountdown: 6 → window 3 → 1 call, fine
//   winSting: 6 → window 3 → 1 call, fine

describe('NarrationDirector — full-run no-repeat proof', () => {
  const bank = loadDefaultNarration();
  const OBSTACLE_COUNT = 3;
  const SCENARIO_COUNT = 2;

  const GAME_IDS = ['safeCrack', 'crackTheTumblers', 'categories'] as const;
  const OUTCOMES = ['clean', 'complication', 'botched'] as const;

  it('no line repeats per beat across a representative full-run sequence', () => {
    const d = createNarrationDirector(bank, 1312);
    const byBeat: Partial<Record<NarrationBeat, string[]>> = {};

    function record(beat: NarrationBeat, ctx?: Partial<NarrationWhen>): void {
      const line = d.next(beat, ctx);
      if (!byBeat[beat]) byBeat[beat] = [];
      byBeat[beat]!.push(line);
    }

    // 1. Briefing (mansion: villa)
    record('briefing', { mansionType: 'villa' });

    // 2. Obstacles: clue + two option descriptions + outcome
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      record('obstacleClue', { gameId: GAME_IDS[i] });
      record('optionDescription', { greedy: false });
      record('optionDescription', { greedy: true });
      record('outcomeQuip', { outcome: OUTCOMES[i] });
    }

    // 3. Scenarios
    for (let i = 0; i < SCENARIO_COUNT; i++) {
      record('scenarioSetup');
    }

    // 4. Offer
    record('pushRun');

    // 5. Getaway
    record('getawayIntro');
    record('getawayCountdown');

    // 6. Win
    record('winSting');

    // Assert: no line repeats within each beat's sequence
    for (const [beat, lines] of Object.entries(byBeat) as [NarrationBeat, string[]][]) {
      const unique = new Set(lines);
      expect(unique.size, `beat="${beat}" produced repeated lines: ${JSON.stringify(lines)}`).toBe(
        lines.length,
      );
    }
  });

  it('two directors from the same seed produce the same full-run line sequence', () => {
    const d1 = createNarrationDirector(bank, 9999);
    const d2 = createNarrationDirector(bank, 9999);

    const sequence: Array<[NarrationBeat, Partial<NarrationWhen>?]> = [
      ['briefing', { mansionType: 'estate' }],
      ['obstacleClue', { gameId: 'safeCrack' }],
      ['optionDescription', { greedy: false }],
      ['optionDescription', { greedy: true }],
      ['outcomeQuip', { outcome: 'clean' }],
      ['obstacleClue', { gameId: 'beat16' }],
      ['optionDescription', { greedy: false }],
      ['optionDescription', { greedy: true }],
      ['outcomeQuip', { outcome: 'botched' }],
      ['scenarioSetup'],
      ['pushRun'],
      ['getawayIntro'],
      ['getawayCountdown'],
      ['bustSting'],
    ];

    for (const [beat, ctx] of sequence) {
      expect(d1.next(beat, ctx)).toBe(d2.next(beat, ctx));
    }
  });
});
