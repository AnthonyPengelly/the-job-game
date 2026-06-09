import type { MiniGame } from '@/minigames/contract';
import type { SteadyHandsParams } from './generate';
import { generate } from './generate';
import type { SteadyHandsState } from './judge';
import { judge, extraHandsBoost } from './judge';
import { SteadyHandsComponent } from './component';

export type { SteadyHandsParams } from './generate';
export type { SteadyHandsState } from './judge';

export const steadyHands: MiniGame<SteadyHandsParams, SteadyHandsState> = {
  id: 'steadyHands' as import('@/engine').GameId,
  lanes: ['physical', 'stealth'],
  minCommit: 1,
  generate,
  Component: SteadyHandsComponent,
  judge,
  boosts: [extraHandsBoost],
};
