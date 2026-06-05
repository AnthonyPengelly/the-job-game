import type { MiniGame } from './contract';
import { safeCrack } from './games/safe-crack';
import { crackTheTumblers } from './games/crack-the-tumblers';
import { crackTheTumblersSolo } from './games/crack-the-tumblers-solo';

/**
 * Single registration point for all mini-game modules.
 * To add a game: import its module and push it here (one edit).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const games: MiniGame<any, any>[] = [safeCrack, crackTheTumblers, crackTheTumblersSolo];

/** Look up a registered game by its GameId string. Returns undefined if not found. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGame(id: string): MiniGame<any, any> | undefined {
  return games.find((g) => g.id === id);
}

/** Returns true when a game with the given id is registered. */
export function hasGame(id: string): boolean {
  return games.some((g) => g.id === id);
}
