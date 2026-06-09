import type { MiniGame } from '@/minigames/contract';
import type { CrackTheTumblersParams } from './generate';
import { generate } from './generate';
import type { CrackTheTumblersState } from './judge';
import { judge, resetPinBoost } from './judge';
import { CrackTheTumblersComponent } from './component';

export type { CrackTheTumblersParams } from './generate';
export type { CrackTheTumblersState } from './judge';

export const crackTheTumblers: MiniGame<CrackTheTumblersParams, CrackTheTumblersState> = {
  id: 'crackTheTumblers' as import('@/engine').GameId,
  name: 'Crack the Tumblers',
  lanes: ['tech'],
  minCommit: 2,
  soloVariantId: 'crackTheTumblersSolo' as import('@/engine').GameId,
  generate,
  Component: CrackTheTumblersComponent,
  judge,
  boosts: [resetPinBoost],
  armedInstructions:
    'Play your number cards in ascending order — one per turn, lowest to highest. ' +
    'One card out of sequence trips the alarm. Reset Pin undoes one clash.',
};
