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
    name: 'Categories',
    lanes: ['charm'],
    minCommit: 1,
    fullTeam: true,
    generate: makeGenerate(items),
    Component: CategoriesComponent,
    judge,
    boosts: [skipBoost],
    armedInstructions:
      'The whole table plays. The category appears the moment you hit START and the clock ' +
      'starts with it — read it out instantly, loud and fast. The crew shouts answers round ' +
      'the table; tap +1 for every answer that fits (no repeats). Hit the count before the ' +
      'buzzer for a clean pass. Skip swaps a dud category — once, if someone holds the power-up.',
  };
}
