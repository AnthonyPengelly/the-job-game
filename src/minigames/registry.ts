import type { MiniGame } from './contract';
import type { EngineConfig } from '@/engine/config';
import { safeCrack } from './games/safe-crack';
import { crackTheTumblers } from './games/crack-the-tumblers';
import { crackTheTumblersSolo } from './games/crack-the-tumblers-solo';
import { beat16 } from './games/beat-16';
import { followTheCircuit } from './games/follow-the-circuit';
import { makeCategories } from './games/categories';

/**
 * Static games that do not depend on preset data.
 * Categories is omitted here — it requires the bank from the active preset.
 * Exported so tests can push mock games and restore the array length.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const games: MiniGame<any, any>[] = [safeCrack, crackTheTumblers, crackTheTumblersSolo, beat16, followTheCircuit];

/**
 * Build the full game registry from the active EngineConfig.
 * Returns all games including Categories bound to the preset's bank.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRegistry(config: EngineConfig): MiniGame<any, any>[] {
  return [...games, makeCategories(config.banks.categories)];
}

/** Look up a registered game by its GameId string. Returns undefined if not found. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGame(id: string): MiniGame<any, any> | undefined {
  return games.find((g) => g.id === id);
}

/** Returns true when a game with the given id is registered. */
export function hasGame(id: string): boolean {
  return games.some((g) => g.id === id);
}
