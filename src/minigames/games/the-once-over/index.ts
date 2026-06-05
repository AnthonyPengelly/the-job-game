import type { MiniGame } from '@/minigames/contract';
import type { OnceOverParams } from './generate';
import { generate } from './generate';
import type { OnceOverState } from './judge';
import { judge, hunchBoost } from './judge';
import { TheOnceOverComponent } from './component';

export type { OnceOverParams, AppliedChange, ChangeType } from './generate';
export type { OnceOverState } from './judge';

export const theOnceOver: MiniGame<OnceOverParams, OnceOverState> = {
  id: 'theOnceOver' as import('@/engine').GameId,
  lanes: ['stealth'],
  minCommit: 1,
  generate,
  Component: TheOnceOverComponent,
  judge,
  boosts: [hunchBoost],
};
