import type { Rng } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';

export type WireColor = 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'white';
export type WireSymbol = 'circle' | 'square' | 'triangle' | 'star';
export type CutRuleProperty = 'color' | 'symbol';

export interface WireCard {
  id: CardId;
  color: WireColor;
  symbol: WireSymbol;
}

export interface CutRule {
  property: CutRuleProperty;
  value: string;
  /** Human-readable rule shown in the rulebook, e.g. "Cut RED wires". */
  text: string;
}

export interface DefuseParams {
  /** The row of wires the GM sees on the console (and the crew sees as physical cards). */
  wires: WireCard[];
  /** The cut rules that constitute the player's private rulebook. */
  cutRules: CutRule[];
  /** Pre-computed ids of wires that match at least one cut rule (safe to cut). */
  safeWireIds: CardId[];
  /** Challenge timer in seconds. */
  timerSeconds: number;
}

const COLORS: readonly WireColor[] = ['red', 'blue', 'green', 'yellow', 'orange', 'white'];
const SYMBOLS: readonly WireSymbol[] = ['circle', 'square', 'triangle', 'star'];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function wireIsSafe(wire: WireCard, rules: CutRule[]): boolean {
  return rules.some(r =>
    r.property === 'color' ? wire.color === r.value : wire.symbol === r.value,
  );
}

/**
 * Generate Defuse the Alarm parameters from the dial.
 *
 * Dial levers (higher dial.level = harder):
 *   - wireCount: more wires at higher difficulty (fewer items at lower dial)
 *   - ruleCount: more rules at higher difficulty (simpler rulebook at lower dial)
 *   - timerSeconds: less time at higher difficulty (more time at lower dial)
 *
 * Ensures at least one safe wire exists so the game is always solvable.
 * Same seed + same dial ⇒ identical params (determinism / replayability).
 */
export function generate(rng: Rng, dial: Difficulty): DefuseParams {
  const wireCount = clamp(Math.round(6 + dial.level), 4, 10);
  const ruleCount = clamp(Math.round(2 + dial.level * 0.5), 1, 4);
  const timerSeconds = clamp(Math.round(120 - dial.level * 20), 60, 180);

  // Build the pool of unique (property, value) candidates for cut rules
  interface RuleCandidate {
    property: CutRuleProperty;
    value: string;
    text: string;
  }
  const candidates: RuleCandidate[] = [
    ...COLORS.map(c => ({
      property: 'color' as const,
      value: c,
      text: `Cut ${c.toUpperCase()} wires`,
    })),
    ...SYMBOLS.map(s => ({
      property: 'symbol' as const,
      value: s,
      text: `Cut ${s.toUpperCase()} wires`,
    })),
  ];

  // Draw ruleCount unique cut rules
  const cutRules: CutRule[] = [];
  let pool = [...candidates];
  for (let i = 0; i < ruleCount && pool.length > 0; i++) {
    const picked = rng.pick(pool);
    cutRules.push(picked);
    pool = pool.filter(p => p !== picked);
  }

  // Generate wires
  const wires: WireCard[] = [];
  for (let i = 0; i < wireCount; i++) {
    wires.push({
      id: `wire-${i}` as CardId,
      color: rng.pick([...COLORS]),
      symbol: rng.pick([...SYMBOLS]),
    });
  }

  // Guarantee at least one safe wire so the game is always solvable
  if (cutRules.length > 0 && !wires.some(w => wireIsSafe(w, cutRules))) {
    const firstRule = cutRules[0]!;
    const w = wires[0]!;
    if (firstRule.property === 'color') {
      wires[0] = { ...w, color: firstRule.value as WireColor };
    } else {
      wires[0] = { ...w, symbol: firstRule.value as WireSymbol };
    }
  }

  const safeWireIds = wires.filter(w => wireIsSafe(w, cutRules)).map(w => w.id);

  return { wires, cutRules, safeWireIds, timerSeconds };
}
