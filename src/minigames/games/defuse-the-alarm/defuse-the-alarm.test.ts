import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate, classifyWires, renderRuleLines, solveDeal } from './generate';
import type { WireCard, WireSuit } from './generate';
import { judge, insulatedGlovesBoost } from './judge';
import type { DefuseState } from './judge';
import { defuseTheAlarm } from './index';
import { getGame } from '@/minigames/registry';

const dial = (level: number): Difficulty => ({ level });

const SUITS: readonly WireSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/** Deal `n` unique cards from a 52-card pack via the seeded RNG. */
function randomDeal(rng: ReturnType<typeof mulberry32>, n: number): WireCard[] {
  const pack: WireCard[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) pack.push({ rank, suit });
  }
  const deal: WireCard[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng.next() * pack.length);
    deal.push(pack.splice(idx, 1)[0]!);
  }
  return deal;
}

// ── Registry ──────────────────────────────────────────────────────────────────

describe('defuseTheAlarm registry', () => {
  it('is registered and getGame returns the module', () => {
    expect(getGame('defuseTheAlarm')).toBe(defuseTheAlarm);
  });

  it('has id defuseTheAlarm', () => {
    expect(defuseTheAlarm.id).toBe('defuseTheAlarm');
  });

  it('has lanes charm and stealth', () => {
    expect(defuseTheAlarm.lanes).toEqual(['charm', 'stealth']);
  });

  it('has minCommit 2 (excluded from solo)', () => {
    expect(defuseTheAlarm.minCommit).toBe(2);
  });

  it('has no soloVariantId (excluded, not variant-served)', () => {
    expect(defuseTheAlarm.soloVariantId).toBeUndefined();
  });

  it('has one boost hook (Insulated Gloves)', () => {
    expect(defuseTheAlarm.boosts).toHaveLength(1);
    expect(defuseTheAlarm.boosts[0]!.label).toBe('Insulated Gloves');
  });
});

// ── Generator ────────────────────────────────────────────────────────────────

describe('generate — first-match rulebooks over a physical deal', () => {
  it('same seed + same dial ⇒ identical params', () => {
    const d = dial(0);
    expect(generate(mulberry32(7), d)).toEqual(generate(mulberry32(7), d));
  });

  it('always contains at least one cutting clause (something to do)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generate(mulberry32(seed), dial((seed % 5) - 1));
      const cutting = p.clauses.filter(c => c.type === 'cut' || c.type === 'cutTop');
      expect(cutting.length).toBeGreaterThan(0);
    }
  });

  it('every clause renders to a non-empty rulebook line', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = generate(mulberry32(seed), dial(2));
      expect(p.ruleLines.length).toBeGreaterThanOrEqual(p.clauses.length + 1);
      p.ruleLines.forEach(line => expect(line.length).toBeGreaterThan(0));
      expect(p.ruleLines).toEqual(renderRuleLines(p.clauses));
    }
  });

  it('never draws both colour cuts (everything-cut rulebooks are degenerate)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generate(mulberry32(seed), dial(4)); // max complexity
      const colours = p.clauses.filter(c => c.type === 'cut' && c.pred.kind === 'color');
      expect(colours.length).toBeLessThanOrEqual(1);
    }
  });

  it('never draws both value bands across cuts and unless riders', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generate(mulberry32(seed), dial(4));
      let bands = 0;
      for (const c of p.clauses) {
        if (c.type === 'cut') {
          if (c.pred.kind === 'low' || c.pred.kind === 'high') bands++;
          if (c.unless?.kind === 'low' || c.unless?.kind === 'high') bands++;
        }
      }
      expect(bands).toBeLessThanOrEqual(1);
    }
  });

  it('a face protection never coexists with a face cut or face unless (dead rules)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generate(mulberry32(seed), dial(4));
      const keepFace = p.clauses.some(c => c.type === 'keep' && c.pred.kind === 'face');
      if (!keepFace) continue;
      for (const c of p.clauses) {
        if (c.type === 'cut') {
          expect(c.pred.kind).not.toBe('face');
          expect(c.unless?.kind).not.toBe('face');
        }
      }
    }
  });

  it('at most one positional ban per rulebook', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generate(mulberry32(seed), dial(4));
      const positions = p.clauses.filter(c => c.type === 'keepPosition');
      expect(positions.length).toBeLessThanOrEqual(1);
    }
  });

  it('higher dial ⇒ more or equal wires; less or equal time', () => {
    const easy = generate(mulberry32(1), dial(-2));
    const hard = generate(mulberry32(1), dial(3));
    expect(hard.wireCount).toBeGreaterThanOrEqual(easy.wireCount);
    expect(hard.timerSeconds).toBeLessThanOrEqual(easy.timerSeconds);
  });

  it('wireCount stays within a dealable range [5, 9]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.wireCount).toBeGreaterThanOrEqual(5);
      expect(p.wireCount).toBeLessThanOrEqual(9);
    }
  });

  it('timerSeconds is always within [45, 120]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.timerSeconds).toBeGreaterThanOrEqual(45);
      expect(p.timerSeconds).toBeLessThanOrEqual(120);
    }
  });

  it('every shape occurs across seeds incl. the wave-4 deduction clauses', () => {
    const seen = {
      unless: false, position: false, keep: false, cutTop: false,
      neighbor: false, superlative: false,
    };
    for (let seed = 1; seed <= 600; seed++) {
      const p = generate(mulberry32(seed), dial(4));
      for (const c of p.clauses) {
        if (c.type === 'cut' && c.unless !== undefined) seen.unless = true;
        if (c.type === 'keepPosition') seen.position = true;
        if (c.type === 'keep') seen.keep = true;
        if (c.type === 'cutTop') seen.cutTop = true;
        if (c.type === 'cutNeighbor') seen.neighbor = true;
        if (c.type === 'cutSuperlative') seen.superlative = true;
      }
    }
    expect(seen).toEqual({
      unless: true, position: true, keep: true, cutTop: true,
      neighbor: true, superlative: true,
    });
  });

  it('at most one neighbour clause and one superlative clause per rulebook', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = generate(mulberry32(seed), dial(4));
      expect(p.clauses.filter(c => c.type === 'cutNeighbor').length).toBeLessThanOrEqual(1);
      expect(p.clauses.filter(c => c.type === 'cutSuperlative').length).toBeLessThanOrEqual(1);
    }
  });

  it('clause count rises with the dial (3 floor, up to 6)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const easy = generate(mulberry32(seed), dial(-2));
      const brutal = generate(mulberry32(seed), dial(4));
      expect(easy.clauses.length).toBeGreaterThanOrEqual(3);
      expect(brutal.clauses.length).toBeGreaterThanOrEqual(easy.clauses.length);
      expect(brutal.clauses.length).toBeLessThanOrEqual(6);
    }
  });
});

// ── Wave 4: solveDeal + the new clause classifiers ────────────────────────────

describe('solveDeal — GM enters the row, gets the cuts in order', () => {
  it('returns per-wire verdicts and 1-based cut positions left-to-right', () => {
    const clauses: import('./generate').RuleClause[] = [{ type: 'cut', pred: { kind: 'color', color: 'red' } }];
    const deal: WireCard[] = [
      { rank: 5, suit: 'spades' },   // black → keep
      { rank: 9, suit: 'hearts' },   // red → cut (pos 2)
      { rank: 2, suit: 'clubs' },    // black → keep
      { rank: 12, suit: 'diamonds' },// red → cut (pos 4)
    ];
    const { verdicts, cutOrder } = solveDeal(clauses, deal);
    expect(verdicts).toEqual(['keep', 'cut', 'keep', 'cut']);
    expect(cutOrder).toEqual([2, 4]);
  });

  it('cutSuperlative cuts the single highest wire, ties broken leftmost', () => {
    const deal: WireCard[] = [
      { rank: 13, suit: 'hearts' },  // King — highest, leftmost of the tie → cut
      { rank: 13, suit: 'spades' },  // King — tie, but not leftmost → keep
      { rank: 4, suit: 'clubs' },
    ];
    const { cutOrder } = solveDeal([{ type: 'cutSuperlative', extreme: 'highest' }], deal);
    expect(cutOrder).toEqual([1]);
  });

  it('cutSuperlative lowest cuts the single lowest wire (ties leftmost)', () => {
    const deal: WireCard[] = [
      { rank: 7, suit: 'hearts' },
      { rank: 2, suit: 'clubs' },   // lowest → cut
      { rank: 9, suit: 'spades' },
    ];
    const { cutOrder } = solveDeal([{ type: 'cutSuperlative', extreme: 'lowest' }], deal);
    expect(cutOrder).toEqual([2]);
  });

  it('cutNeighbor (left) cuts a wire whose left neighbour matches; end wire is safe', () => {
    const deal: WireCard[] = [
      { rank: 11, suit: 'spades' },  // pos1: no left neighbour → keep
      { rank: 3, suit: 'clubs' },    // pos2: left is a face (J) → cut
      { rank: 12, suit: 'hearts' },  // pos3: left (3) not a face → keep
      { rank: 5, suit: 'clubs' },    // pos4: left (Q) is a face → cut
    ];
    const { cutOrder } = solveDeal(
      [{ type: 'cutNeighbor', side: 'left', pred: { kind: 'face' } }],
      deal,
    );
    expect(cutOrder).toEqual([2, 4]);
  });

  it('first-match-wins still holds with a protection before a superlative cut', () => {
    const deal: WireCard[] = [
      { rank: 13, suit: 'hearts' },  // King, but a face → protected by rule 1
      { rank: 9, suit: 'clubs' },
    ];
    const { cutOrder } = solveDeal(
      [{ type: 'keep', pred: { kind: 'face' } }, { type: 'cutSuperlative', extreme: 'highest' }],
      deal,
    );
    // The King is kept (protection wins), so nothing is cut.
    expect(cutOrder).toEqual([]);
  });
});

// ── Decidability property test (playtest wave 2 acceptance) ───────────────────

describe('classifyWires — every card classifies unambiguously for any deal', () => {
  it('1000 seeds × random 8-card deals: total, deterministic, never throws', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = mulberry32(seed);
      const level = (seed % 6) - 1; // sweep dial −1..4
      const params = generate(rng, dial(level));
      const deal = randomDeal(rng, 8);

      const verdicts = classifyWires(params.clauses, deal);
      expect(verdicts).toHaveLength(deal.length);
      for (const v of verdicts) {
        expect(v === 'cut' || v === 'keep').toBe(true);
      }
      // Deterministic: same rulebook + same deal ⇒ same verdicts.
      expect(classifyWires(params.clauses, deal)).toEqual(verdicts);
    }
  });

  it('rulebooks meaningfully split a typical row — not degenerate all-cut/all-keep', () => {
    // Wave 4: relational/superlative clauses are position-dependent, so an
    // adversarially-ordered full pack can be fully covered without the rulebook
    // being degenerate. The honest guarantee is over RANDOM deals: a brutal
    // rulebook leaves keeps on most rows and cuts on most rows.
    let withKeep = 0;
    let withCut = 0;
    const N = 500;
    for (let seed = 1; seed <= N; seed++) {
      const rng = mulberry32(seed);
      const params = generate(rng, dial(4));
      const deal = randomDeal(rng, 8);
      const verdicts = classifyWires(params.clauses, deal);
      if (verdicts.includes('keep')) withKeep++;
      if (verdicts.includes('cut')) withCut++;
    }
    // Both outcomes are common — the rulebook is neither vacuously all-cut nor
    // all-keep across the sample.
    expect(withKeep / N).toBeGreaterThan(0.6);
    expect(withCut / N).toBeGreaterThan(0.6);
  });

  it('first-match-wins: a protection placed before a cut shields matching wires', () => {
    const verdicts = classifyWires(
      [
        { type: 'keep', pred: { kind: 'face' } },
        { type: 'cut', pred: { kind: 'color', color: 'black' } },
      ],
      [
        { rank: 12, suit: 'spades' }, // black face → kept by rule 1
        { rank: 4, suit: 'clubs' }, // black non-face → cut by rule 2
        { rank: 12, suit: 'hearts' }, // red face → kept by rule 1
        { rank: 4, suit: 'diamonds' }, // uncovered → default keep
      ],
    );
    expect(verdicts).toEqual(['keep', 'cut', 'keep', 'keep']);
  });

  it('unless exempts from one clause but later clauses may still cut', () => {
    const verdicts = classifyWires(
      [
        { type: 'cut', pred: { kind: 'color', color: 'black' }, unless: { kind: 'face' } },
        { type: 'cut', pred: { kind: 'high' } },
      ],
      [
        { rank: 11, suit: 'spades' }, // black face → exempt from 1, high? no (faces don't count) → keep
        { rank: 9, suit: 'clubs' }, // black 9 → cut by rule 1
        { rank: 10, suit: 'hearts' }, // red 10 → rule 1 no, rule 2 cut
      ],
    );
    expect(verdicts).toEqual(['keep', 'cut', 'cut']);
  });

  it('positional ban protects only the named end', () => {
    const deal: WireCard[] = [
      { rank: 2, suit: 'clubs' },
      { rank: 3, suit: 'spades' },
      { rank: 4, suit: 'clubs' },
    ];
    const verdicts = classifyWires(
      [
        { type: 'keepPosition', pos: 'leftmost' },
        { type: 'cut', pred: { kind: 'color', color: 'black' } },
      ],
      deal,
    );
    expect(verdicts).toEqual(['keep', 'cut', 'cut']);
  });

  it('count-based cut takes the N highest of the suit and keeps the rest of it', () => {
    const deal: WireCard[] = [
      { rank: 12, suit: 'hearts' },
      { rank: 7, suit: 'hearts' },
      { rank: 2, suit: 'hearts' },
      { rank: 13, suit: 'spades' },
    ];
    const verdicts = classifyWires([{ type: 'cutTop', count: 2, suit: 'hearts' }], deal);
    expect(verdicts).toEqual(['cut', 'cut', 'keep', 'keep']);
  });

  it('count-based cut with fewer suit cards than the count cuts what exists', () => {
    const deal: WireCard[] = [
      { rank: 7, suit: 'hearts' },
      { rank: 13, suit: 'spades' },
    ];
    const verdicts = classifyWires([{ type: 'cutTop', count: 2, suit: 'hearts' }], deal);
    expect(verdicts).toEqual(['cut', 'keep']);
  });
});

// ── judge ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<DefuseState> = {}): DefuseState {
  return {
    safeCuts: 0,
    wrongCut: false,
    allClear: false,
    timerExpired: false,
    glovesArmed: false,
    wrongCutForgiven: false,
    ...overrides,
  };
}

describe('judge — three tier boundaries', () => {
  it('complication when game is in progress (default suggestion)', () => {
    expect(judge(makeState({ safeCuts: 2 }))).toBe('complication');
  });

  it('clean when GM declares all clear with no wrong cut', () => {
    expect(judge(makeState({ safeCuts: 3, allClear: true }))).toBe('clean');
  });

  it('clean when all clear even if timer also expired (target met trumps timer)', () => {
    expect(judge(makeState({ allClear: true, timerExpired: true }))).toBe('clean');
  });

  it('botched when timer expires before all clear', () => {
    expect(judge(makeState({ safeCuts: 1, timerExpired: true }))).toBe('botched');
  });

  it('botched when any wrong cut is recorded', () => {
    expect(judge(makeState({ safeCuts: 4, wrongCut: true, allClear: true }))).toBe('botched');
  });
});

// ── clearChannelBoost ─────────────────────────────────────────────────────────

describe('insulatedGlovesBoost (Insulated Gloves)', () => {
  const params = generate(mulberry32(1), dial(0));

  it('has lane charm and label Insulated Gloves', () => {
    expect(insulatedGlovesBoost.lane).toBe('charm');
    expect(insulatedGlovesBoost.label).toBe('Insulated Gloves');
  });

  it('arms when no wrong cut has happened yet', () => {
    const next = insulatedGlovesBoost.apply(makeState(), params);
    expect(next.glovesArmed).toBe(true);
    expect(next.wrongCutForgiven).toBe(false);
  });

  it('takes back an already-recorded wrong cut', () => {
    const next = insulatedGlovesBoost.apply(makeState({ wrongCut: true }), params);
    expect(next.wrongCut).toBe(false);
    expect(next.wrongCutForgiven).toBe(true);
  });

  it('is idempotent once armed or spent', () => {
    const armed = makeState({ glovesArmed: true });
    expect(insulatedGlovesBoost.apply(armed, params)).toBe(armed);
    const spent = makeState({ wrongCutForgiven: true });
    expect(insulatedGlovesBoost.apply(spent, params)).toBe(spent);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    insulatedGlovesBoost.apply(state, params);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('judge — forgiven wrong cut caps at complication', () => {
  it('all clear with a forgiven cut suggests complication, not clean', () => {
    expect(judge(makeState({ allClear: true, wrongCutForgiven: true }))).toBe('complication');
  });

  it('all clear with no forgiveness stays clean', () => {
    expect(judge(makeState({ allClear: true }))).toBe('clean');
  });
});

// ── Wave 3: complexity floor ──────────────────────────────────────────────────

describe('generate — wave 3 difficulty floor', () => {
  it('every rulebook has at least 2 clauses, even at a rock-bottom dial', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = generate(mulberry32(seed), dial(-3));
      expect(p.clauses.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('a count-based cut is never the entire rulebook', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = generate(mulberry32(seed), dial((seed % 5) - 2));
      const hasCutTop = p.clauses.some(c => c.type === 'cutTop');
      if (hasCutTop) expect(p.clauses.length).toBeGreaterThanOrEqual(2);
    }
  });
});
