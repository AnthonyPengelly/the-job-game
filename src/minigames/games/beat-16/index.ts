import type { MiniGame } from '@/minigames/contract';
import type { Beat16Params } from './generate';
import { generate } from './generate';
import type { Beat16State } from './judge';
import { judge, inTheBonesBoost } from './judge';
import { Beat16Component } from './component';

export type { Beat16Params } from './generate';
export type { Beat16State } from './judge';

export const beat16: MiniGame<Beat16Params, Beat16State> = {
  id: 'beat16' as import('@/engine').GameId,
  name: 'Beat 16',
  lanes: ['physical'],
  minCommit: 1,
  generate,
  Component: Beat16Component,
  judge,
  boosts: [inTheBonesBoost],
  armedInstructions:
    'The metronome plays then mutes — the crew keeps counting silently and the player ' +
    'SLAPS THE TABLE on the target beat. GM: tap the button the instant you hear the slap; ' +
    'the app credits your reaction time and shows how close they were — reveal it with drama. ' +
    'In the Bones adds two more audible beats before the mute.',
};
