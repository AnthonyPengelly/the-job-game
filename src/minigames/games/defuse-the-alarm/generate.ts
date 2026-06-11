import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';

export type CutRuleKind = 'color' | 'suit' | 'face' | 'low' | 'high';

export interface CutRule {
  kind: CutRuleKind;
  /** Stable identifier, e.g. 'color-red', 'suit-hearts', 'low-5'. */
  id: string;
  /** Human-readable rule shown in both rulebooks, e.g. "Cut RED wires". */
  text: string;
}

export interface DefuseParams {
  /** How many random cards the GM deals face-up in a row as the wires. */
  wireCount: number;
  /** The cut rules that constitute the reader's private rulebook. */
  cutRules: CutRule[];
  /** Challenge timer in seconds. */
  timerSeconds: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface RuleCandidate extends CutRule {
  /** Rules sharing an exclusion group cannot be drawn together. */
  group: string;
}

/**
 * Rule candidates over standard-pack properties only, so any random deal
 * works. Exclusion groups stop degenerate rulebooks: never both colors
 * (everything would be safe), at most one of each numeric band.
 */
const CANDIDATES: RuleCandidate[] = [
  { kind: 'color', id: 'color-red', text: 'Cut RED wires (hearts & diamonds)', group: 'color' },
  { kind: 'color', id: 'color-black', text: 'Cut BLACK wires (clubs & spades)', group: 'color' },
  { kind: 'suit', id: 'suit-hearts', text: 'Cut HEART wires', group: 'suit-a' },
  { kind: 'suit', id: 'suit-diamonds', text: 'Cut DIAMOND wires', group: 'suit-b' },
  { kind: 'suit', id: 'suit-clubs', text: 'Cut CLUB wires', group: 'suit-c' },
  { kind: 'suit', id: 'suit-spades', text: 'Cut SPADE wires', group: 'suit-d' },
  { kind: 'face', id: 'face', text: 'Cut FACE-CARD wires (J, Q, K)', group: 'face' },
  { kind: 'low', id: 'low-5', text: 'Cut wires 5 or lower (Ace counts as 1)', group: 'band' },
  { kind: 'high', id: 'high-9', text: 'Cut wires 9 or higher (10 counts, faces don’t)', group: 'band' },
];

/**
 * Generate Defuse the Alarm parameters from the dial.
 *
 * The wires are physical: the GM deals `wireCount` random cards face-up in a
 * row. The rules reference standard-card properties (colour, suit, face,
 * value bands), so they are decidable for ANY deal — the app never needs to
 * know the cards. The reader on the player-view holds the rules; the crew
 * describes the row; the GM (who can see both the row and the rules) records
 * each cut as safe or wrong and declares all-clear.
 *
 * Dial levers (higher dial.level = harder):
 *   - wireCount: more wires at higher difficulty (4..8)
 *   - ruleCount: more rules to hold in mind (1..4)
 *   - timerSeconds: less time (60..180)
 *
 * Same seed + same dial ⇒ identical params (determinism / replayability).
 */
export function generate(rng: Rng, dial: Difficulty): DefuseParams {
  const wireCount = clamp(Math.round(5 + dial.level), 4, 8);
  const ruleCount = clamp(Math.round(2 + dial.level * 0.5), 1, 4);
  const timerSeconds = clamp(Math.round(120 - dial.level * 20), 60, 180);

  const cutRules: CutRule[] = [];
  const usedGroups = new Set<string>();
  let pool = [...CANDIDATES];
  while (cutRules.length < ruleCount && pool.length > 0) {
    const picked = rng.pick(pool);
    pool = pool.filter(p => p !== picked);
    if (usedGroups.has(picked.group)) continue;
    usedGroups.add(picked.group);
    cutRules.push({ kind: picked.kind, id: picked.id, text: picked.text });
  }

  return { wireCount, cutRules, timerSeconds };
}
