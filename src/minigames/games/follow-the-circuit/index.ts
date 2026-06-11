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
  name: 'Follow the Circuit',
  lanes: ['tech', 'physical'],
  minCommit: 1,
  generate,
  Component: FollowTheCircuitComponent,
  judge,
  boosts: [photographicBoost],
  armedInstructions:
    'The one screen-share game: turn this screen to face the committed crew before you hit ' +
    'START. They watch the pads light up in sequence, then tap the same sequence back on the ' +
    'screen. A wrong tap breaks the circuit. Photographic replays the sequence once.',
};
