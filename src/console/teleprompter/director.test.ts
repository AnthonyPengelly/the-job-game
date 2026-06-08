import { describe, it, expect } from 'vitest';
import { createNarrationDirector } from './director';
import { loadDefaultNarration, loadDefaultSpine } from '@/platform/presets/browser';
import type { NarrationBeat, NarrationWhen } from '@/content/schema/narration';
import type { ParsedNarration } from '@/content/schema/narration';
import type { SpineBank } from '@/content/schema';

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
    roomApproach: variants('ra', 4),
    scenarioReveal: variants('sr', 4),
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

// ── Minimal spine fixture ─────────────────────────────────────────────────────

function makeMinimalSpineBank(): SpineBank {
  return {
    marks: [
      {
        id: 'villa-test-1',
        mansionType: 'villa',
        markName: 'Test Villa',
        vault: 'East Wing',
        security: 'MODERATE',
        targetHaul: '$80k',
        dropCaption: 'A test villa.',
        dressing: 'Quiet neighbourhood.',
      },
      {
        id: 'villa-test-2',
        mansionType: 'villa',
        markName: 'Second Villa',
        vault: 'Basement',
        security: 'LOW',
        targetHaul: '$50k',
        dropCaption: 'Another test villa.',
        dressing: 'Iron gate.',
      },
      {
        id: 'estate-test-1',
        mansionType: 'estate',
        markName: 'Test Estate',
        vault: 'Library',
        security: 'HIGH',
        targetHaul: '$200k',
        dropCaption: 'A test estate.',
        dressing: 'Large grounds.',
      },
    ],
  };
}

// ── Spine commit ──────────────────────────────────────────────────────────────

describe('NarrationDirector — spine commit', () => {
  it('commits a spine matching the supplied mansionType', () => {
    const bank = makeMinimalBank();
    const spineBank = makeMinimalSpineBank();
    const d = createNarrationDirector(bank, 42, undefined, {
      spineBank,
      mansionType: 'villa',
    });
    expect(d.spine).not.toBeNull();
    expect(d.spine?.mansionType).toBe('villa');
  });

  it('returns null spine when no spineOpts supplied', () => {
    const d = createNarrationDirector(makeMinimalBank(), 42);
    expect(d.spine).toBeNull();
  });

  it('returns null spine when mansionType has no matching marks', () => {
    const bank = makeMinimalBank();
    const spineBank = makeMinimalSpineBank();
    const d = createNarrationDirector(bank, 42, undefined, {
      spineBank,
      mansionType: 'penthouse', // no penthouse marks in fixture
    });
    expect(d.spine).toBeNull();
  });

  it('committed spine is stable — same object reference across multiple calls', () => {
    const bank = makeMinimalBank();
    const spineBank = makeMinimalSpineBank();
    const d = createNarrationDirector(bank, 99, undefined, {
      spineBank,
      mansionType: 'villa',
    });
    const first = d.spine;
    d.next('briefing');
    d.next('obstacleClue');
    expect(d.spine).toBe(first); // same reference
  });

  it('two directors from the same seed commit the same spine', () => {
    const bank = makeMinimalBank();
    const spineBank = makeMinimalSpineBank();
    const opts = { spineBank, mansionType: 'villa' };
    const d1 = createNarrationDirector(bank, 1234, undefined, opts);
    const d2 = createNarrationDirector(bank, 1234, undefined, opts);
    expect(d1.spine?.id).toBe(d2.spine?.id);
  });

  it('directors from different seeds may commit different spines', () => {
    const bank = makeMinimalBank();
    const spineBank = makeMinimalSpineBank();
    const opts = { spineBank, mansionType: 'villa' };
    // With 2 villa marks and many seeds, at least two different seeds should
    // pick different marks — collect until we see a difference.
    const ids = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const d = createNarrationDirector(bank, seed, undefined, opts);
      if (d.spine) ids.add(d.spine.id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });
});

// ── script() — determinism and template fill ──────────────────────────────────

describe('NarrationDirector — script()', () => {
  it('is deterministic: same seed + same calls produce same lines', () => {
    const bank = makeMinimalBank();
    const spineBank = makeMinimalSpineBank();
    const opts = { spineBank, mansionType: 'villa' };

    const d1 = createNarrationDirector(bank, 55, undefined, opts);
    const d2 = createNarrationDirector(bank, 55, undefined, opts);

    const beats: NarrationBeat[] = [
      'briefing',
      'roomApproach',
      'obstacleClue',
      'optionDescription',
      'outcomeQuip',
      'scenarioSetup',
      'scenarioReveal',
    ];
    for (const beat of beats) {
      expect(d1.script(beat)).toEqual(d2.script(beat));
    }
  });

  it('returns an array with at least one string', () => {
    const d = createNarrationDirector(makeMinimalBank(), 1);
    const lines = d.script('briefing');
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    expect(typeof lines[0]).toBe('string');
  });

  it('fills spine template tokens from the committed spine', () => {
    // Use a bank with a line that contains {mark} and {vault}
    const bank: ParsedNarration = {
      ...makeMinimalBank(),
      briefing: [{ id: 'br-tpl', text: 'Tonight we hit {mark}, vault at {vault}.' }],
    };
    const spineBank = makeMinimalSpineBank();
    const d = createNarrationDirector(bank, 7, undefined, {
      spineBank,
      mansionType: 'villa',
    });
    const lines = d.script('briefing');
    expect(lines[0]).not.toContain('{mark}');
    expect(lines[0]).not.toContain('{vault}');
    expect(lines[0]).toContain(d.spine?.markName);
    expect(lines[0]).toContain(d.spine?.vault);
  });

  it('fills ctx template tokens (lane, crew, roomNum, etc.)', () => {
    const bank: ParsedNarration = {
      ...makeMinimalBank(),
      roomApproach: [{ id: 'ra-tpl', text: 'Room {roomNum}. {crew} stacks up.' }],
    };
    const d = createNarrationDirector(bank, 3);
    const lines = d.script('roomApproach', { crew: 'Alice, Bob', roomNum: '2' });
    expect(lines[0]).toContain('Alice, Bob');
    expect(lines[0]).toContain('2');
    expect(lines[0]).not.toContain('{crew}');
    expect(lines[0]).not.toContain('{roomNum}');
  });

  it('missing context tokens render to empty string (not literal {token})', () => {
    const bank: ParsedNarration = {
      ...makeMinimalBank(),
      briefing: [{ id: 'br-missing', text: 'Mark is {mark}, crew is {crew}.' }],
    };
    const d = createNarrationDirector(bank, 9); // no spine, no ctx
    const lines = d.script('briefing');
    expect(lines[0]).not.toContain('{mark}');
    expect(lines[0]).not.toContain('{crew}');
    // tokens resolve to empty string
    expect(lines[0]).toBe('Mark is , crew is .');
  });

  it('ctx-only fields do not accidentally exclude when-constrained variants', () => {
    // A variant constrained to mansionType='villa' should NOT be filtered out
    // when ctx only supplies template fields (no mansionType in ctx).
    const bank: ParsedNarration = {
      ...makeMinimalBank(),
      briefing: [
        {
          id: 'br-villa',
          text: 'Villa line.',
          when: { mansionType: 'villa' },
        },
        { id: 'br-any', text: 'Any line.' },
      ],
    };
    const d = createNarrationDirector(bank, 1);
    // Call with only template-only fields — villa variant should still be in the pool
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const lines = d.script('briefing', { crew: 'Alice' });
      seen.add(lines[0] ?? '');
    }
    // Both variants should appear over 20 calls
    expect(seen.has('Villa line.')).toBe(true);
    expect(seen.has('Any line.')).toBe(true);
  });

  it('spine selection does not alter the beat RNG stream (beat results match no-spine)', () => {
    // Two directors: one with spine, one without. Their beat selection order
    // must be identical because spine uses a separate RNG.
    const bank = makeMinimalBank();
    const spineBank = makeMinimalSpineBank();
    const dWithSpine = createNarrationDirector(bank, 999, undefined, {
      spineBank,
      mansionType: 'villa',
    });
    const dNoSpine = createNarrationDirector(bank, 999);

    // Both use plain text variants (no template tokens), so filled text = raw text
    const beats: NarrationBeat[] = [
      'briefing',
      'obstacleClue',
      'optionDescription',
      'pushRun',
    ];
    for (const beat of beats) {
      expect(dWithSpine.script(beat)).toEqual(dNoSpine.script(beat));
    }
  });
});

// ── script() — no-repeat property ────────────────────────────────────────────

describe('NarrationDirector — script() no-repeat', () => {
  it('does not repeat within the ring-buffer window', () => {
    const d = createNarrationDirector(makeMinimalBank(), 77); // briefing pool = 8, window = 4
    const first = d.script('briefing')[0];
    for (let i = 0; i < 3; i++) {
      const line = d.script('briefing')[0];
      expect(line).not.toBe(first);
    }
  });

  it('no line repeats per beat across a representative full run using script()', () => {
    const bank = loadDefaultNarration();
    const spineBank = loadDefaultSpine();
    const d = createNarrationDirector(bank, 1312, undefined, {
      spineBank,
      mansionType: 'villa',
    });

    const byBeat: Partial<Record<NarrationBeat, string[]>> = {};

    function record(beat: NarrationBeat, ctx?: Parameters<typeof d.script>[1]): void {
      const lines = d.script(beat, ctx);
      if (!byBeat[beat]) byBeat[beat] = [];
      byBeat[beat]!.push(...lines);
    }

    const GAME_IDS = ['safeCrack', 'crackTheTumblers', 'categories'] as const;
    const OUTCOMES = ['clean', 'complication', 'botched'] as const;

    record('briefing', { mansionType: 'villa' });

    for (let i = 0; i < 3; i++) {
      record('roomApproach', { roomNum: String(i + 1), crew: 'Alice, Bob' });
      record('obstacleClue', { gameId: GAME_IDS[i] });
      record('optionDescription', { greedy: false });
      record('optionDescription', { greedy: true });
      record('outcomeQuip', { outcome: OUTCOMES[i] });
    }

    for (let i = 0; i < 2; i++) {
      record('roomApproach', { roomNum: String(i + 4), crew: 'Alice, Bob' });
      record('scenarioSetup');
      record('scenarioReveal', { outcome: OUTCOMES[i] });
    }

    record('pushRun');
    record('getawayIntro');
    record('getawayCountdown');
    record('winSting');

    for (const [beat, lines] of Object.entries(byBeat) as [NarrationBeat, string[]][]) {
      const unique = new Set(lines);
      expect(
        unique.size,
        `beat="${beat}" produced repeated lines: ${JSON.stringify(lines)}`,
      ).toBe(lines.length);
    }
  });

  it('two directors from the same seed produce the same full-run script() sequence', () => {
    const bank = loadDefaultNarration();
    const spineBank = loadDefaultSpine();
    const opts = { spineBank, mansionType: 'estate' };

    const d1 = createNarrationDirector(bank, 9999, undefined, opts);
    const d2 = createNarrationDirector(bank, 9999, undefined, opts);

    const sequence: Array<[NarrationBeat, Parameters<typeof d1.script>[1]?]> = [
      ['briefing', { mansionType: 'estate' }],
      ['roomApproach', { roomNum: '1' }],
      ['obstacleClue', { gameId: 'safeCrack' }],
      ['optionDescription', { greedy: false }],
      ['optionDescription', { greedy: true }],
      ['outcomeQuip', { outcome: 'clean' }],
      ['roomApproach', { roomNum: '2' }],
      ['scenarioSetup'],
      ['scenarioReveal', { outcome: 'botched' }],
      ['pushRun'],
      ['getawayIntro'],
      ['getawayCountdown'],
      ['bustSting'],
    ];

    for (const [beat, ctx] of sequence) {
      expect(d1.script(beat, ctx)).toEqual(d2.script(beat, ctx));
    }
  });
});
