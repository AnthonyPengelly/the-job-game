import type { MiniGame } from '@/minigames/contract';
import type { DefuseParams } from './generate';
import { generate } from './generate';
import type { DefuseState } from './judge';
import { judge, clearChannelBoost } from './judge';
import { DefuseComponent } from './component';

export type { DefuseParams } from './generate';
export type { DefuseState } from './judge';

export const defuseTheAlarm: MiniGame<DefuseParams, DefuseState> = {
  id: 'defuseTheAlarm' as import('@/engine').GameId,
  name: 'Defuse the Alarm',
  lanes: ['charm', 'stealth'],
  minCommit: 2,
  generate,
  Component: DefuseComponent,
  judge,
  boosts: [clearChannelBoost],
  armedInstructions:
    'A row of cards is the alarm wiring. One player sees the rulebook (not the cards); ' +
    'the others see the cards (not the rules). Call out what you see and follow the rules to cut the right wires. ' +
    'Clear Channel allows one full spoken sentence through; shout it once.',
};
