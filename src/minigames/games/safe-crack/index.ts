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
    'Guess the hidden combination — the app feeds back how many digits are correct ' +
    'and how many are in the right position. Reason it out in limited attempts. ' +
    'Stethoscope reveals one digit\'s exact position; shout it once.',
};
