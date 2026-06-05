import type { MiniGame } from '@/minigames/contract';
import type { CategoriesParams } from './generate';
import { generate } from './generate';
import type { CategoriesState } from './judge';
import { judge, skipBoost } from './judge';
import { CategoriesComponent } from './component';

export type { CategoriesParams } from './generate';
export type { CategoriesState } from './judge';

export const categories: MiniGame<CategoriesParams, CategoriesState> = {
  id: 'categories' as import('@/engine').GameId,
  lanes: ['charm'],
  minCommit: 1,
  generate,
  Component: CategoriesComponent,
  judge,
  boosts: [skipBoost],
};
