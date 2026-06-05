import type { MiniGame } from '@/minigames/contract';
import type { AssemblyLineParams } from './generate';
import { generate } from './generate';
import type { AssemblyLineState } from './judge';
import { judge, quickHandsBoost, tipOffBoost } from './judge';
import { AssemblyLineComponent } from './component';

export type { AssemblyLineParams } from './generate';
export type { AssemblyLineState } from './judge';

export const assemblyLine: MiniGame<AssemblyLineParams, AssemblyLineState> = {
  id: 'assemblyLine' as import('@/engine').GameId,
  lanes: ['physical', 'charm'],
  minCommit: 2,
  generate,
  Component: AssemblyLineComponent,
  judge,
  boosts: [quickHandsBoost, tipOffBoost],
};
