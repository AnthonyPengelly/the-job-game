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
  name: 'Silence',
  lanes: ['physical', 'charm'],
  minCommit: 2,
  fullTeam: true,
  generate,
  Component: AssemblyLineComponent,
  judge,
  boosts: [tipOffBoost],
  armedInstructions:
    'The whole table plays in silence. Build the deck as the screen says (all four of some ' +
    'ranks, plus a few bogus singles), deal four each — some hold five. On a silent count ' +
    'everyone passes one card left at once, fast as they can, collecting four of a kind; lay ' +
    'a set down to go safe. Tell me every time a set is complete. Tip-Off names the real ranks.',
};
