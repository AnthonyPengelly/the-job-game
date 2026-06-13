import type { MiniGame } from '@/minigames/contract';
import type { CrackTheTumblersParams } from './generate';
import { generate } from './generate';
import type { CrackTheTumblersState } from './judge';
import { judge, resetPinBoost } from './judge';
import { CrackTheTumblersComponent } from './component';

export type { CrackTheTumblersParams } from './generate';
export type { CrackTheTumblersState } from './judge';

export const crackTheTumblers: MiniGame<CrackTheTumblersParams, CrackTheTumblersState> = {
  id: 'crackTheTumblers' as import('@/engine').GameId,
  name: 'Crack the Tumblers',
  lanes: ['tech'],
  minCommit: 2,
  fullTeam: true,
  soloVariantId: 'crackTheTumblersSolo' as import('@/engine').GameId,
  generate,
  Component: CrackTheTumblersComponent,
  judge,
  boosts: [resetPinBoost],
  armedInstructions:
    'Deal the whole pack-slice across the crew (the screen shows how many each). No talking: ' +
    'the crew plays every card to the table in ascending rank order, Ace low. On equal ranks ' +
    'they must go in suit order — Clubs, Diamonds, Hearts, Spades. A card out of rank OR suit ' +
    'order is a clash — the alarm. Reset Pin hands one clash back.',
};
