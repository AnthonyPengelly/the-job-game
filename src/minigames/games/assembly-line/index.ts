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
    'The whole table plays — the screen tells you exactly which ranks to pull from the pack ' +
    'and deal. Everyone trades simultaneously (shout what you want, take what you need) to ' +
    'collect four of a kind. Tell me every time a set is complete. Tip-Off names the ranks in play.',
};
