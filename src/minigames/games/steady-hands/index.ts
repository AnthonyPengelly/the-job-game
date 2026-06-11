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
  name: 'Steady Hands',
  lanes: ['physical', 'stealth'],
  minCommit: 1,
  generate,
  Component: SteadyHandsComponent,
  judge,
  boosts: [extraHandsBoost],
  armedInstructions:
    'Build a card house to the target height before the timer runs out — without it toppling. ' +
    'A tier is a storey: two leaning cards capped with a flat card. Tap +1 as each tier stands. ' +
    'Extra Hands: shout it once for 10 seconds where everyone (including benched crew) can help build.',
};
