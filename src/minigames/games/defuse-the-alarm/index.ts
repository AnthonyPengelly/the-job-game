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
  lanes: ['charm', 'stealth'],
  minCommit: 2,
  generate,
  Component: DefuseComponent,
  judge,
  boosts: [clearChannelBoost],
};
