import type { MiniGame } from '@/minigames/contract';
import type { TriviaItemConfig } from '@/engine/config';
import type { InsideKnowledgeParams } from './generate';
import { makeGenerate } from './generate';
import type { InsideKnowledgeState } from './judge';
import { judge, narrowItDownBoost } from './judge';
import { InsideKnowledgeComponent } from './component';

export type { InsideKnowledgeParams } from './generate';
export type { InsideKnowledgeState } from './judge';

/**
 * Factory that creates an Inside Knowledge MiniGame bound to the given trivia bank.
 * Called from the registry with the active preset's trivia items.
 */
export function makeInsideKnowledge(items: TriviaItemConfig[]): MiniGame<InsideKnowledgeParams, InsideKnowledgeState> {
  return {
    id: 'insideKnowledge' as import('@/engine').GameId,
    lanes: ['tech', 'charm'],
    minCommit: 1,
    fullTeam: true,
    generate: makeGenerate(items),
    Component: InsideKnowledgeComponent,
    judge,
    boosts: [narrowItDownBoost],
    armedInstructions:
      'The whole table plays — I read questions rapid-fire, the crew calls out answers. ' +
      'Mark each correct or wrong. Hit the threshold before time runs out. ' +
      'Narrow It Down turns one open question into four options — the correct one is marked for you.',
  };
}
