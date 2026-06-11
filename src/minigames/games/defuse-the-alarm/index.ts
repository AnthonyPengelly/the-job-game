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
    'Deal a row of random cards face-up — the alarm wiring. One player (the reader) holds ' +
    'the rulebook on the player-view and cannot see the cards; the crew sees the cards but not ' +
    'the rules. They describe, the reader names the cuts, you referee. ' +
    'Clear Channel allows one full spoken sentence through; shout it once.',
};
