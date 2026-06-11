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
  name: 'Safe-Crack',
  lanes: ['tech', 'stealth'],
  minCommit: 1,
  generate,
  Component: SafeCrackComponent,
  judge,
  boosts: [techBoost],
  armedInstructions:
    'The crew cracks a hidden combination by deduction: they call out a guess, you type it ' +
    'in, and you read back the feedback — how many digits are right, and how many sit in the ' +
    'right position. Limited attempts, ticking clock. Stethoscope reveals one digit\'s exact ' +
    'position; shout it once.',
};
