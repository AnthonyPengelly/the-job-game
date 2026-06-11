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
    'Two-player variant — the screen tells you exactly which ranks to pull and deal. ' +
    'Take turns offering one card at a time: accept, counter-offer, or pass, collecting ' +
    'four of a kind. Tell me when a set is complete. Tip-Off names the ranks in play.',
};
