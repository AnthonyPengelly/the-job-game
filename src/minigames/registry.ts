import type { MiniGame } from './contract';
import type { EngineConfig } from '@/engine/config';
import { safeCrack } from './games/safe-crack';
import { crackTheTumblers } from './games/crack-the-tumblers';
import { crackTheTumblersSolo } from './games/crack-the-tumblers-solo';
import { beat16 } from './games/beat-16';
import { followTheCircuit } from './games/follow-the-circuit';
import { theOnceOver } from './games/the-once-over';
import { steadyHands } from './games/steady-hands';
import { assemblyLine } from './games/assembly-line';
import { assemblyLineNegotiated } from './games/assembly-line-negotiated';
import { defuseTheAlarm } from './games/defuse-the-alarm';
import { makeCategories } from './games/categories';
import { makeInsideKnowledge } from './games/inside-knowledge';

/**
 * Static games that do not depend on preset data.
 * Categories and InsideKnowledge are omitted here — they require banks from the active preset.
 * Exported so tests can push mock games and restore the array length.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const games: MiniGame<any, any>[] = [safeCrack, crackTheTumblers, crackTheTumblersSolo, beat16, followTheCircuit, theOnceOver, steadyHands, assemblyLine, assemblyLineNegotiated, defuseTheAlarm];

/**
 * Build the full game registry from the active EngineConfig.
 * Returns all games including bank-bound games (Categories, InsideKnowledge).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRegistry(config: EngineConfig): MiniGame<any, any>[] {
  return [
    ...games,
    makeCategories(config.banks.categories),
    makeInsideKnowledge(config.banks.trivia),
  ];
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
