import type { MiniGame } from '@/minigames/contract';
import type { OnceOverParams } from './generate';
import { generate } from './generate';
import type { OnceOverState } from './judge';
import { judge, hunchBoost } from './judge';
import { TheOnceOverComponent } from './component';

export type { OnceOverParams, PositionChange, ChangeType } from './generate';
export type { OnceOverState } from './judge';

export const theOnceOver: MiniGame<OnceOverParams, OnceOverState> = {
  id: 'theOnceOver' as import('@/engine').GameId,
  name: 'The Once-Over',
  lanes: ['stealth'],
  minCommit: 1,
  generate,
  Component: TheOnceOverComponent,
  judge,
  boosts: [hunchBoost],
  armedInstructions:
    'Deal a row of random cards face-up. The crew studies it under the clock, then looks away ' +
    'while you secretly make the changes the screen gives you (by position). Reveal — they call ' +
    'out what changed and you score each callout. Hunch gives a GM clue.',
};
