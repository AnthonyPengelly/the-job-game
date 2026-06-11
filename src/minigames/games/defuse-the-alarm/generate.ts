import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

// ── Wire model (used by the decidability classifier + property tests) ─────────

export type WireSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

/** A physical wire card: rank 1 (Ace, low) … 13 (King). */
export interface WireCard {
  rank: number;
  suit: WireSuit;
}

const RED_SUITS: readonly WireSuit[] = ['hearts', 'diamonds'];

// ── Rule model ────────────────────────────────────────────────────────────────

export type WirePredicate =
  | { kind: 'color'; color: 'red' | 'black' }
  | { kind: 'suit'; suit: WireSuit }
  | { kind: 'face' }
  | { kind: 'low' } // rank ≤ 5, Ace counts as 1
  | { kind: 'high' }; // rank 9 or 10 — faces don't count

/**
 * One rulebook clause. The rulebook is an ORDERED list: the first clause that
 * covers a wire decides it; wires no clause covers stay uncut. This
 * first-match-wins reading makes every rulebook decidable for ANY deal —
 * exceptions, protections, positional bans and count-based cuts all compose
 * without contradictions (playtest wave 2; property-tested below).
 */
export type RuleClause =
  | { type: 'keepPosition'; pos: 'leftmost' | 'rightmost' }
  | { type: 'keep'; pred: WirePredicate }
  | { type: 'cutTop'; count: number; suit: WireSuit }
  | { type: 'cut'; pred: WirePredicate; unless?: WirePredicate };

export interface DefuseParams {
  /** How many random cards the GM deals face-up in a row as the wires. */
  wireCount: number;
  /** Ordered rulebook clauses (first match decides). */
  clauses: RuleClause[];
  /** Rendered rulebook lines (numbered clauses + reading instructions). */
  ruleLines: string[];
  /** Challenge timer in seconds. */
  timerSeconds: number;
}

// ── Predicate matching + classifier ───────────────────────────────────────────

export function matchesPredicate(pred: WirePredicate, card: WireCard): boolean {
  switch (pred.kind) {
    case 'color': {
      const isRed = RED_SUITS.includes(card.suit);
      return pred.color === 'red' ? isRed : !isRed;
    }
    case 'suit':
      return card.suit === pred.suit;
    case 'face':
      return card.rank >= 11;
    case 'low':
      return card.rank <= 5;
    case 'high':
      return card.rank === 9 || card.rank === 10;
    default: {
      const _exhaustive: never = pred;
      return _exhaustive;
    }
  }
}

/**
 * Classify every wire in a deal against an ordered rulebook.
 * Total and pure: every card gets exactly one verdict, first clause that
 * covers it wins, uncovered cards default to 'keep'. This is the decidability
 * contract the property test pins for 1000 seeds × random deals.
 */
export function classifyWires(
  clauses: readonly RuleClause[],
  deal: readonly WireCard[],
): Array<'cut' | 'keep'> {
  return deal.map((card, index) => {
    for (const clause of clauses) {
      switch (clause.type) {
        case 'keepPosition': {
          const target = clause.pos === 'leftmost' ? 0 : deal.length - 1;
          if (index === target) return 'keep';
          break;
        }
        case 'keep': {
          if (matchesPredicate(clause.pred, card)) return 'keep';
          break;
        }
        case 'cutTop': {
          if (card.suit !== clause.suit) break;
          // All wires of the suit are covered by this clause: the `count`
          // highest cut, the rest explicitly kept. Ranks within one suit are
          // unique in a single pack, so "highest" is never ambiguous.
          const suitRanks = deal
            .filter(c => c.suit === clause.suit)
            .map(c => c.rank)
            .sort((a, b) => b - a);
          const cutoff = suitRanks[Math.min(clause.count, suitRanks.length) - 1];
          return cutoff !== undefined && card.rank >= cutoff ? 'cut' : 'keep';
        }
        case 'cut': {
          if (clause.unless !== undefined && matchesPredicate(clause.unless, card)) {
            break; // exempt from THIS clause — later clauses may still cover it
          }
          if (matchesPredicate(clause.pred, card)) return 'cut';
          break;
        }
      }
    }
    return 'keep';
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const SUIT_LABEL: Record<WireSuit, string> = {
  hearts: 'HEART',
  diamonds: 'DIAMOND',
  clubs: 'CLUB',
  spades: 'SPADE',
};

function predText(pred: WirePredicate): string {
  switch (pred.kind) {
    case 'color':
      return pred.color === 'red'
        ? 'RED wires (hearts & diamonds)'
        : 'BLACK wires (clubs & spades)';
    case 'suit':
      return `${SUIT_LABEL[pred.suit]} wires`;
    case 'face':
      return 'FACE-CARD wires (J, Q, K)';
    case 'low':
      return 'wires 5 or lower (Ace counts as 1)';
    case 'high':
      return 'wires showing 9 or 10 (faces don’t count)';
    default: {
      const _exhaustive: never = pred;
      return _exhaustive;
    }
  }
}

function unlessText(pred: WirePredicate): string {
  switch (pred.kind) {
    case 'face':
      return 'it’s a face card (J, Q, K)';
    case 'low':
      return 'it’s 5 or lower (Ace counts as 1)';
    case 'high':
      return 'it’s a 9 or 10';
    case 'suit':
      return `it’s a ${SUIT_LABEL[pred.suit]}`;
    case 'color':
      return `it’s ${pred.color.toUpperCase()}`;
    default: {
      const _exhaustive: never = pred;
      return _exhaustive;
    }
  }
}

const COUNT_WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR'] as const;

export function clauseText(clause: RuleClause): string {
  switch (clause.type) {
    case 'keepPosition':
      return `Never cut the ${clause.pos.toUpperCase()} wire in the row.`;
    case 'keep':
      return `Never cut ${predText(clause.pred)}.`;
    case 'cutTop': {
      const word = COUNT_WORDS[clause.count] ?? String(clause.count);
      return `Cut exactly the ${word} highest ${SUIT_LABEL[clause.suit]} wires — no other ${SUIT_LABEL[clause.suit]}S (Ace is lowest).`;
    }
    case 'cut':
      return clause.unless !== undefined
        ? `Cut ${predText(clause.pred)} — UNLESS ${unlessText(clause.unless)}.`
        : `Cut ${predText(clause.pred)}.`;
    default: {
      const _exhaustive: never = clause;
      return _exhaustive;
    }
  }
}

/** Render the full rulebook: numbered clauses plus the reading instructions. */
export function renderRuleLines(clauses: readonly RuleClause[]): string[] {
  const lines = clauses.map((c, i) => `${i + 1}. ${clauseText(c)}`);
  if (clauses.length > 1) {
    lines.push('Read top to bottom — the FIRST rule that covers a wire decides it.');
  }
  lines.push('Any wire no rule covers stays UNCUT.');
  return lines;
}

// ── Generation ────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface CutBase {
  pred: WirePredicate;
  /** Exclusion groups this base occupies (no two clauses share a group). */
  groups: string[];
}

const CUT_BASES: CutBase[] = [
  { pred: { kind: 'color', color: 'red' }, groups: ['color', 'suit-hearts', 'suit-diamonds'] },
  { pred: { kind: 'color', color: 'black' }, groups: ['color', 'suit-clubs', 'suit-spades'] },
  { pred: { kind: 'suit', suit: 'hearts' }, groups: ['color', 'suit-hearts'] },
  { pred: { kind: 'suit', suit: 'diamonds' }, groups: ['color', 'suit-diamonds'] },
  { pred: { kind: 'suit', suit: 'clubs' }, groups: ['color', 'suit-clubs'] },
  { pred: { kind: 'suit', suit: 'spades' }, groups: ['color', 'suit-spades'] },
  { pred: { kind: 'face' }, groups: ['face'] },
  { pred: { kind: 'low' }, groups: ['band'] },
  { pred: { kind: 'high' }, groups: ['band'] },
];

const ALL_SUITS: readonly WireSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/**
 * Generate Defuse the Alarm parameters from the dial.
 *
 * The wires stay physical: the GM deals `wireCount` random cards face-up in a
 * row; the rules reference standard-pack properties so ANY deal is decidable
 * (the app never needs to know the cards). The rulebook is an ordered
 * first-match-wins list mixing four shapes (playtest wave 2):
 *   protections  — "Never cut FACE-CARD wires."
 *   positional   — "Never cut the LEFTMOST wire in the row."
 *   count-based  — "Cut exactly the TWO highest HEART wires."
 *   exceptions   — "Cut BLACK wires — UNLESS it's a face card."
 *
 * Exclusion groups stop degenerate rulebooks (never both colours, one value
 * band, a protection never erases its own cut clause). At least one cutting
 * clause is always present.
 *
 * Dial levers (higher dial.level = harder):
 *   - wireCount: more wires at higher difficulty (4..8)
 *   - complexity: more/spicier clauses (1..4)
 *   - timerSeconds: less time (60..180)
 */
export function generate(rng: Rng, dial: Difficulty): DefuseParams {
  const wireCount = clamp(Math.round(5 + dial.level), 4, 8);
  const complexity = clamp(Math.round(2 + dial.level * 0.5), 1, 4);
  const timerSeconds = clamp(Math.round(120 - dial.level * 20), 60, 180);

  const usedGroups = new Set<string>();

  function takeCutBase(): WirePredicate | undefined {
    const pool = CUT_BASES.filter(b => !b.groups.some(g => usedGroups.has(g)));
    if (pool.length === 0) return undefined;
    const picked = rng.pick(pool);
    picked.groups.forEach(g => usedGroups.add(g));
    return picked.pred;
  }

  // Budget: each clause costs 1 point; an `unless` rider costs 1 point.
  let budget = complexity;
  const keeps: RuleClause[] = [];
  const cutTops: RuleClause[] = [];
  const cuts: RuleClause[] = [];

  // 1. Always one cutting clause. At complexity ≥2 it may be the count-based
  //    shape instead of a plain predicate cut.
  if (budget >= 2 && rng.next() < 0.3) {
    const suit = rng.pick([...ALL_SUITS]);
    usedGroups.add('color');
    usedGroups.add(`suit-${suit}`);
    // A suit's highest cards are usually faces — a face protection would
    // starve the count-based cut (vacuous rulebook), so the face group is
    // spent here too.
    usedGroups.add('face');
    cutTops.push({ type: 'cutTop', count: 2, suit });
    budget -= 2; // count-based reads as two rules' worth of thinking
  } else {
    const pred = takeCutBase();
    if (pred !== undefined) cuts.push({ type: 'cut', pred });
    budget -= 1;
  }

  // 2. Spend the rest on riders, protections, positional bans, extra cuts.
  while (budget > 0) {
    const roll = rng.next();
    if (roll < 0.3 && cuts.length > 0 && cuts[cuts.length - 1]!.type === 'cut' && (cuts[cuts.length - 1] as { unless?: WirePredicate }).unless === undefined) {
      // Exception rider on the last plain cut: face, or a free band.
      const lastCut = cuts[cuts.length - 1] as { type: 'cut'; pred: WirePredicate; unless?: WirePredicate };
      const qualifiers: WirePredicate[] = [];
      if (!usedGroups.has('face') && lastCut.pred.kind !== 'face') qualifiers.push({ kind: 'face' });
      if (!usedGroups.has('band') && (lastCut.pred.kind === 'color' || lastCut.pred.kind === 'suit')) {
        qualifiers.push({ kind: 'low' }, { kind: 'high' });
      }
      if (qualifiers.length > 0) {
        const q = rng.pick(qualifiers);
        lastCut.unless = q;
        usedGroups.add(q.kind === 'face' ? 'face' : 'band');
        budget -= 1;
        continue;
      }
    }
    if (roll < 0.55 && !usedGroups.has('position')) {
      usedGroups.add('position');
      keeps.push({ type: 'keepPosition', pos: rng.pick(['leftmost', 'rightmost']) });
      budget -= 1;
      continue;
    }
    if (roll < 0.8 && !usedGroups.has('face')) {
      // Protection: never cut face cards. (Suit protections are covered by the
      // exclusion groups; face protection is the table-favourite shape.)
      usedGroups.add('face');
      keeps.push({ type: 'keep', pred: { kind: 'face' } });
      budget -= 1;
      continue;
    }
    // Extra plain cut clause if one is still legal; otherwise stop spending.
    const pred = takeCutBase();
    if (pred === undefined) break;
    cuts.push({ type: 'cut', pred });
    budget -= 1;
  }

  // Reading order: protections first, then count-based, then cuts — the order
  // the table can actually apply.
  const clauses: RuleClause[] = [...keeps, ...cutTops, ...cuts];

  return { wireCount, clauses, ruleLines: renderRuleLines(clauses), timerSeconds };
}
