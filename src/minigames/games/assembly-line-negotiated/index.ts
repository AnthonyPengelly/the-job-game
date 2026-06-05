import type { MiniGame } from '@/minigames/contract';
import type { AssemblyLineNegotiatedParams } from './generate';
import { generate } from './generate';
import type { AssemblyLineNegotiatedState } from './judge';
import { judge, quickHandsBoost, tipOffBoost } from './judge';
import { AssemblyLineNegotiatedComponent } from './component';

export type { AssemblyLineNegotiatedParams } from './generate';
export type { AssemblyLineNegotiatedState } from './judge';

export const assemblyLineNegotiated: MiniGame<AssemblyLineNegotiatedParams, AssemblyLineNegotiatedState> = {
  id: 'assemblyLineNegotiated' as import('@/engine').GameId,
  lanes: ['physical', 'charm'],
  minCommit: 2,
  generate,
  Component: AssemblyLineNegotiatedComponent,
  judge,
  boosts: [quickHandsBoost, tipOffBoost],
};
