import type { MiniGame } from '@/minigames/contract';
import type { DefuseParams } from './generate';
import { generate } from './generate';
import type { DefuseState } from './judge';
import { judge, insulatedGlovesBoost } from './judge';
import { DefuseComponent } from './component';

export type { DefuseParams, RuleClause, WireCard, WirePredicate, WireSuit } from './generate';
export { classifyWires, matchesPredicate, renderRuleLines, clauseText } from './generate';
export type { DefuseState } from './judge';

export const defuseTheAlarm: MiniGame<DefuseParams, DefuseState> = {
  id: 'defuseTheAlarm' as import('@/engine').GameId,
  name: 'Defuse the Alarm',
  lanes: ['charm', 'stealth'],
  minCommit: 2,
  generate,
  Component: DefuseComponent,
  judge,
  boosts: [insulatedGlovesBoost],
  armedInstructions:
    'Deal a row of random cards face-up — the alarm wiring. One player (the reader) gets the ' +
    'rulebook and cannot see the cards; the crew sees the cards but not the rules. They ' +
    'describe, the reader names the cuts. With a second screen the reader uses the ' +
    'player-view and you referee live; with one laptop you hand THIS machine to the reader ' +
    '(it shows only the rules and the clock) and check the row when it comes back. ' +
    'Insulated Gloves forgives one wrong cut — shout it once, before or right after the snip.',
};
