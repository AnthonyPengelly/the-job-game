import type { MiniGame } from '@/minigames/contract';
import type { CategoriesParams } from './generate';
import { makeGenerate } from './generate';
import type { CategoriesState } from './judge';
import { judge, skipBoost } from './judge';
import { CategoriesComponent } from './component';

export type { CategoriesParams } from './generate';
export type { CategoriesState } from './judge';

/**
 * Factory that creates a Categories MiniGame bound to the given item bank.
 * Called from the registry with the active preset's bank items.
 */
export function makeCategories(items: string[]): MiniGame<CategoriesParams, CategoriesState> {
  return {
    id: 'categories' as import('@/engine').GameId,
    lanes: ['charm'],
    minCommit: 1,
    fullTeam: true,
    generate: makeGenerate(items),
    Component: CategoriesComponent,
    judge,
    boosts: [skipBoost],
  };
}
