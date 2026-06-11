import type { MiniGame } from '@/minigames/contract';
import type { CrackTheTumblersSoloParams } from './generate';
import { generate } from './generate';
import type { CrackTheTumblersSoloState } from './judge';
import { judge, resetPinBoost } from './judge';
import { CrackTheTumblersSoloComponent } from './component';

export type { CrackTheTumblersSoloParams } from './generate';
export type { CrackTheTumblersSoloState } from './judge';

export const crackTheTumblersSolo: MiniGame<CrackTheTumblersSoloParams, CrackTheTumblersSoloState> = {
  id: 'crackTheTumblersSolo' as import('@/engine').GameId,
  name: 'Crack the Tumblers (Solo)',
  lanes: ['tech'],
  minCommit: 1,
  generate,
  Component: CrackTheTumblersSoloComponent,
  judge,
  boosts: [resetPinBoost],
  armedInstructions:
    'Deal a row of random cards face-up; the player studies it under the clock, then it is ' +
    'flipped face-down in place. They flip cards back one at a time in ascending order — a ' +
    'lower reveal trips the alarm. Reset Pin turns one wrong flip back over.',
};
