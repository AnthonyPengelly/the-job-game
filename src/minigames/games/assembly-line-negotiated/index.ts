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
  name: 'Assembly Line (Negotiated)',
  lanes: ['physical', 'charm'],
  minCommit: 2,
  fullTeam: true,
  generate,
  Component: AssemblyLineNegotiatedComponent,
  judge,
  boosts: [tipOffBoost],
  armedInstructions:
    'The whole table plays — take turns offering one card at a time (negotiated swap). ' +
    'Accept, counter-offer, or pass. Each player tries to collect a complete set. ' +
    'Tell me every time one is complete. Tip-Off reveals which types are actually in play.',
};
