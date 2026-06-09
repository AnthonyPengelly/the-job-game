import type { MiniGame } from '@/minigames/contract';
import type { SafeCrackParams } from './generate';
import { generate } from './generate';
import type { SafeCrackState } from './judge';
import { judge, techBoost } from './judge';
import { SafeCrackComponent } from './component';

export type { SafeCrackParams } from './generate';
export type { SafeCrackState, GuessResult } from './judge';

export const safeCrack: MiniGame<SafeCrackParams, SafeCrackState> = {
  id: 'safeCrack' as import('@/engine').GameId,
  lanes: ['tech', 'stealth'],
  minCommit: 1,
  generate,
  Component: SafeCrackComponent,
  judge,
  boosts: [techBoost],
};
