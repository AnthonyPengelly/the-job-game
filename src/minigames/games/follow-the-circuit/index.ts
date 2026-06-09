import type { MiniGame } from '@/minigames/contract';
import type { FollowTheCircuitParams } from './generate';
import { generate } from './generate';
import type { FollowTheCircuitState } from './judge';
import { judge, photographicBoost } from './judge';
import { FollowTheCircuitComponent } from './component';

export type { FollowTheCircuitParams } from './generate';
export type { FollowTheCircuitState } from './judge';

export const followTheCircuit: MiniGame<FollowTheCircuitParams, FollowTheCircuitState> = {
  id: 'followTheCircuit' as import('@/engine').GameId,
  lanes: ['tech', 'physical'],
  minCommit: 1,
  generate,
  Component: FollowTheCircuitComponent,
  judge,
  boosts: [photographicBoost],
};
