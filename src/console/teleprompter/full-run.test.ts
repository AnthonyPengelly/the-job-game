/**
 * Full-run coherence and no-repeat sensor for the narration director.
 *
 * Simulates a worst-case run sequence (8 rooms: 5 obstacles + 3 scenarios)
 * and asserts:
 *  (a) No line repeats within any beat across the entire run.
 *  (b) Two directors from the same seed produce identical output (determinism).
 *
 * This is the E17.5 acceptance sensor. It must pass under `npm run check:full`.
 */

import { describe, it, expect } from 'vitest';
import { createNarrationDirector } from './director';
import { loadDefaultNarration, loadDefaultSpine } from '@/platform/presets/browser';
import type { NarrationBeat, NarrationWhen } from '@/content/schema/narration';

const bank = loadDefaultNarration();
const spineBank = loadDefaultSpine();

// All game ids used in the test runs
const ALL_GAME_IDS = [
  'safeCrack',
  'crackTheTumblers',
  'categories',
  'beat16',
  'theOnceOver',
] as const;

const OUTCOMES = ['clean', 'complication', 'botched', 'clean', 'complication'] as const;

// ── Worst-case full run ───────────────────────────────────────────────────────
//
// Simulates a run of 8 rooms: 5 obstacles followed by 3 scenarios.
// Beat call counts for this run:
//   briefing:        1
//   roomApproach:    8   (one per room)
//   obstacleClue:    5   (one per obstacle room)
//   optionDescription: 10  (safe + greedy per obstacle)
//   outcomeQuip:     5   (one per obstacle)
//   scenarioSetup:   3   (one per scenario room)
//   scenarioReveal:  3   (one per scenario room)
//   pushRun:         1
//   getawayIntro:    1
//   getawayCountdown: 1
//   winSting/bustSting: 1
//
// Pool sizes (with default bank — counts.test.ts enforces the minimums):
//   briefing (villa filter):  ≥6 → window ≥9 (full bank ≥18) → 1 call, fine
//   roomApproach:             ≥14 → window ≥7 → 8 calls ≤ window, no repeat
//   obstacleClue (per gameId): ≥6 per gameId, window = floor(60+/2)=30 → 1 call each, fine
//   optionDescription:        ≥10 safe + ≥10 greedy = ≥20 total → window ≥10
//                             5 safe + 5 greedy = 10 interleaved calls ≤ window, no repeat
//   outcomeQuip (per outcome): ≥8 per outcome, window=floor(24+/2)=12 → ≤2 per outcome, fine
//   scenarioSetup:            ≥12 → window ≥6 → 3 calls ≤ window, fine
//   scenarioReveal:           ≥14 → window ≥7 → 3 calls ≤ window, fine
//   pushRun:                  ≥12 → window ≥6 → 1 call, fine
//   getawayIntro:             ≥10 → window ≥5 → 1 call, fine
//   getawayCountdown:         ≥10 → window ≥5 → 1 call, fine
//   winSting/bustSting:       ≥10 → window ≥5 → 1 call each, fine

describe('full-run coherence — no-repeat across worst-case sequence', () => {
  const MANSION_TYPES = ['villa', 'estate', 'penthouse'] as const;

  for (const mansionType of MANSION_TYPES) {
    it(`no line repeats per beat — mansionType="${mansionType}", seed=1312`, () => {
      const d = createNarrationDirector(bank, 1312, undefined, { spineBank, mansionType });
      const byBeat: Partial<Record<NarrationBeat, string[]>> = {};

      function record(beat: NarrationBeat, ctx?: Parameters<typeof d.script>[1]): void {
        const lines = d.script(beat, ctx);
        if (!byBeat[beat]) byBeat[beat] = [];
        byBeat[beat]!.push(...lines);
      }

      // 1. Briefing
      record('briefing', { mansionType });

      // 2. 5 obstacle rooms
      for (let i = 0; i < 5; i++) {
        record('roomApproach', { roomNum: String(i + 1), crew: 'Alice, Bob, Charlie' });
        record('obstacleClue', { gameId: ALL_GAME_IDS[i] });
        record('optionDescription', { greedy: false });
        record('optionDescription', { greedy: true });
        record('outcomeQuip', { outcome: OUTCOMES[i] });
      }

      // 3. 3 scenario rooms
      for (let i = 0; i < 3; i++) {
        record('roomApproach', { roomNum: String(i + 6), crew: 'Alice, Bob, Charlie' });
        record('scenarioSetup');
        record('scenarioReveal', { outcome: OUTCOMES[i], attempter: 'Alice' });
      }

      // 4. Offer → Getaway → Win
      record('pushRun', { heatBand: 'warm' });
      record('getawayIntro');
      record('getawayCountdown');
      record('winSting');

      // Assert: no line repeats within any beat's sequence
      for (const [beat, lines] of Object.entries(byBeat) as [NarrationBeat, string[]][]) {
        const unique = new Set(lines);
        expect(
          unique.size,
          `beat="${beat}" (mansionType="${mansionType}") repeated lines: ${JSON.stringify(lines)}`,
        ).toBe(lines.length);
      }
    });
  }
});

// ── Determinism — same seed produces identical output ─────────────────────────

describe('full-run determinism — same seed yields same scripts', () => {
  it('two directors from seed 7777 produce identical full-run line sequence', () => {
    const opts = { spineBank, mansionType: 'estate' };
    const d1 = createNarrationDirector(bank, 7777, undefined, opts);
    const d2 = createNarrationDirector(bank, 7777, undefined, opts);

    // A representative worst-case sequence
    const sequence: Array<[NarrationBeat, Parameters<typeof d1.script>[1]?]> = [
      ['briefing', { mansionType: 'estate' }],
      ['roomApproach', { roomNum: '1', crew: 'Alice, Bob' }],
      ['obstacleClue', { gameId: 'safeCrack' }],
      ['optionDescription', { greedy: false }],
      ['optionDescription', { greedy: true }],
      ['outcomeQuip', { outcome: 'clean' }],
      ['roomApproach', { roomNum: '2', crew: 'Alice, Bob' }],
      ['obstacleClue', { gameId: 'crackTheTumblers' }],
      ['optionDescription', { greedy: false }],
      ['optionDescription', { greedy: true }],
      ['outcomeQuip', { outcome: 'complication' }],
      ['roomApproach', { roomNum: '3', crew: 'Alice, Bob' }],
      ['obstacleClue', { gameId: 'categories' }],
      ['optionDescription', { greedy: false }],
      ['optionDescription', { greedy: true }],
      ['outcomeQuip', { outcome: 'botched' }],
      ['roomApproach', { roomNum: '4', crew: 'Alice, Bob' }],
      ['obstacleClue', { gameId: 'beat16' }],
      ['optionDescription', { greedy: false }],
      ['optionDescription', { greedy: true }],
      ['outcomeQuip', { outcome: 'clean' }],
      ['roomApproach', { roomNum: '5', crew: 'Alice, Bob' }],
      ['obstacleClue', { gameId: 'theOnceOver' }],
      ['optionDescription', { greedy: false }],
      ['optionDescription', { greedy: true }],
      ['outcomeQuip', { outcome: 'complication' }],
      ['roomApproach', { roomNum: '6', crew: 'Alice, Bob' }],
      ['scenarioSetup'],
      ['scenarioReveal', { outcome: 'clean', attempter: 'Bob' }],
      ['roomApproach', { roomNum: '7', crew: 'Alice, Bob' }],
      ['scenarioSetup'],
      ['scenarioReveal', { outcome: 'botched', attempter: 'Alice' }],
      ['roomApproach', { roomNum: '8', crew: 'Alice, Bob' }],
      ['scenarioSetup'],
      ['scenarioReveal', { outcome: 'complication', attempter: 'Bob' }],
      ['pushRun', { heatBand: 'hot' }],
      ['getawayIntro'],
      ['getawayCountdown'],
      ['bustSting'],
    ];

    for (const [beat, ctx] of sequence) {
      expect(d1.script(beat, ctx as Partial<NarrationWhen>)).toEqual(
        d2.script(beat, ctx as Partial<NarrationWhen>),
      );
    }
  });

  it('committed spine is identical for two directors from the same seed', () => {
    const opts = { spineBank, mansionType: 'villa' };
    const d1 = createNarrationDirector(bank, 42, undefined, opts);
    const d2 = createNarrationDirector(bank, 42, undefined, opts);
    expect(d1.spine?.id).toBe(d2.spine?.id);
    expect(d1.spine?.markName).toBe(d2.spine?.markName);
  });
});

// ── Template tokens — no literal {token} in any line of a full run ────────────

describe('full-run template coverage — no unresolved tokens', () => {
  it('no rendered line contains a literal {token} placeholder', () => {
    const d = createNarrationDirector(bank, 5555, undefined, {
      spineBank,
      mansionType: 'penthouse',
    });

    const ctx: Parameters<typeof d.script>[1] = {
      mansionType: 'penthouse',
      crew: 'Eve, Frank',
      attempter: 'Eve',
      roomNum: '3',
      runTotal: '$120k',
      lane: 'tech',
      outcome: 'clean',
      heatBand: 'warm',
      gameId: 'safeCrack',
      greedy: false,
    };

    const beats: NarrationBeat[] = [
      'briefing',
      'roomApproach',
      'obstacleClue',
      'optionDescription',
      'outcomeQuip',
      'scenarioSetup',
      'scenarioReveal',
      'pushRun',
      'getawayIntro',
      'getawayCountdown',
      'winSting',
      'bustSting',
    ];

    const TOKEN_PATTERN = /\{[a-zA-Z]+\}/;
    for (const beat of beats) {
      const lines = d.script(beat, ctx);
      for (const line of lines) {
        expect(
          TOKEN_PATTERN.test(line),
          `beat="${beat}" line contains unresolved token: "${line}"`,
        ).toBe(false);
      }
    }
  });
});
