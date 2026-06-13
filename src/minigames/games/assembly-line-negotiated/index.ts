import type { MiniGame } from '@/minigames/contract';
import type { AssemblyLineNegotiatedParams } from './generate';
import { generate } from './generate';
import type { AssemblyLineNegotiatedState } from './judge';
import { judge, tipOffBoost } from './judge';
import { AssemblyLineNegotiatedComponent } from './component';

export type { AssemblyLineNegotiatedParams } from './generate';
export type { AssemblyLineNegotiatedState } from './judge';

export const assemblyLineNegotiated: MiniGame<AssemblyLineNegotiatedParams, AssemblyLineNegotiatedState> = {
  id: 'assemblyLineNegotiated' as import('@/engine').GameId,
  name: 'Silence',
  lanes: ['physical', 'charm'],
  minCommit: 2,
  fullTeam: true,
  generate,
  Component: AssemblyLineNegotiatedComponent,
  judge,
  boosts: [tipOffBoost],
  armedInstructions:
    'Two-player Silence — build the deck as the screen says, deal four each (one holds five). ' +
    'No talking: on a silent count you both pass one card at once, fast as you can, collecting ' +
    'four of a kind; lay a set down to go safe. Tell me when a set is complete. Tip-Off names ' +
    'the real ranks.',
};
