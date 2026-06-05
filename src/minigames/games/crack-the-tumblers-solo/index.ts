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
  lanes: ['tech'],
  minCommit: 1,
  generate,
  Component: CrackTheTumblersSoloComponent,
  judge,
  boosts: [resetPinBoost],
};
