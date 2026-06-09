import type { MiniGame } from '@/minigames/contract';
import type { AssemblyLineParams } from './generate';
import { generate } from './generate';
import type { AssemblyLineState } from './judge';
import { judge, tipOffBoost } from './judge';
import { AssemblyLineComponent } from './component';

export type { AssemblyLineParams } from './generate';
export type { AssemblyLineState } from './judge';

export const assemblyLine: MiniGame<AssemblyLineParams, AssemblyLineState> = {
  id: 'assemblyLine' as import('@/engine').GameId,
  name: 'Assembly Line',
  lanes: ['physical', 'charm'],
  minCommit: 2,
  fullTeam: true,
  generate,
  Component: AssemblyLineComponent,
  judge,
  boosts: [tipOffBoost],
  armedInstructions:
    'The whole table plays — everyone starts with a hand of cards and trades simultaneously ' +
    '(shout what you want, take what you need). Each player tries to collect a complete set. ' +
    'Tell me every time one is complete. Tip-Off reveals which types are actually in play.',
};
