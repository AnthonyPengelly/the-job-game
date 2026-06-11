import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate, classifyWires, renderRuleLines } from './generate';
import type { WireCard, WireSuit } from './generate';
import { judge, clearChannelBoost } from './judge';
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

  it('has one boost hook (Clear Channel)', () => {
    expect(defuseTheAlarm.boosts).toHaveLength(1);
    expect(defuseTheAlarm.boosts[0]!.label).toBe('Clear Channel');
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

  it('wireCount stays within a dealable range [4, 8]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.wireCount).toBeGreaterThanOrEqual(4);
      expect(p.wireCount).toBeLessThanOrEqual(8);
    }
  });

  it('timerSeconds is always within [60, 180]', () => {
    for (const level of [-100, -2, 0, 2, 100]) {
      const p = generate(mulberry32(1), dial(level));
      expect(p.timerSeconds).toBeGreaterThanOrEqual(60);
      expect(p.timerSeconds).toBeLessThanOrEqual(180);
    }
  });

  it('the richer shapes all occur across seeds (unless, positional, protection, count-based)', () => {
    const seen = { unless: false, position: false, keep: false, cutTop: false };
    for (let seed = 1; seed <= 400; seed++) {
      const p = generate(mulberry32(seed), dial(4));
      for (const c of p.clauses) {
        if (c.type === 'cut' && c.unless !== undefined) seen.unless = true;
        if (c.type === 'keepPosition') seen.position = true;
        if (c.type === 'keep') seen.keep = true;
        if (c.type === 'cutTop') seen.cutTop = true;
      }
    }
    expect(seen).toEqual({ unless: true, position: true, keep: true, cutTop: true });
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

  it('rulebooks never cut the entire pack (degenerate everything-cut) across 500 seeds', () => {
    // A specific 8-card deal may legitimately be all-covered; degeneracy means
    // the RULEBOOK cuts every card that exists. Classify the full 52-card pack.
    const pack: WireCard[] = [];
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) pack.push({ rank, suit });
    }
    for (let seed = 1; seed <= 500; seed++) {
      const rng = mulberry32(seed);
      const params = generate(rng, dial(4));
      const verdicts = classifyWires(params.clauses, pack);
      expect(verdicts).toContain('keep');
      // And never everything-keep either — there is always something to cut.
      expect(verdicts).toContain('cut');
    }
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
    clearChannelUsed: false,
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

describe('clearChannelBoost (Clear Channel)', () => {
  const params = generate(mulberry32(1), dial(0));

  it('has lane charm and label Clear Channel', () => {
    expect(clearChannelBoost.lane).toBe('charm');
    expect(clearChannelBoost.label).toBe('Clear Channel');
  });

  it('sets clearChannelUsed on first use', () => {
    const next = clearChannelBoost.apply(makeState(), params);
    expect(next.clearChannelUsed).toBe(true);
  });

  it('is idempotent when already used', () => {
    const state = makeState({ clearChannelUsed: true });
    expect(clearChannelBoost.apply(state, params)).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    clearChannelBoost.apply(state, params);
    expect(JSON.stringify(state)).toBe(before);
  });
});
