import { useMemo } from 'react';
import { useGameStore } from '@/console/store';
import { getGame } from '@/minigames';
import { rngFromState, resolveGameVariant, computeDial } from '@/engine';
import type { CommittedPlayer, Difficulty } from '@/minigames';
import type { Outcome } from '@/engine';
import { DialReadout } from '@/minigames/primitives/DialReadout';
import { MinigameStub } from './MinigameStub';

/**
 * Mini-game launcher: resolves the committed option's gameId to a registered
 * game module, builds CommittedPlayer projections, computes the dial from
 * committed lane ratings, and memoises params from the seeded RNG.
 *
 * Falls back to MinigameStub for any unregistered gameId (CLAUDE.md rule 1 — no dead-ends).
 * The launcher never mutates engine rngState; generate() draws read-only.
 */
export function MinigameHost() {
  const present = useGameStore(s => s.session.present);
  const cfg = useGameStore(s => s.cfg);
  const dispatch = useGameStore(s => s.dispatch);

  // Derive room/option/game resolution data (computed on every render from live state)
  const room = present.currentRoom;
  const obstacleRoom = room?.kind === 'obstacle' ? room : null;
  const committedOptionId = obstacleRoom?.committedOptionId;
  const committedBy = obstacleRoom?.committedBy;
  const option = obstacleRoom?.options.find(o => o.id === committedOptionId);
  const rawGameId: string | undefined = option?.gameId;

  const headcount = present.crew.length;
  const commitSize = committedBy?.length ?? 0;

  // Resolve variant (e.g. solo variant for commit=1)
  const resolvedGameId = useMemo((): string | undefined => {
    if (rawGameId === undefined) return undefined;
    return resolveGameVariant(rawGameId, commitSize, headcount, cfg);
  }, [rawGameId, commitSize, headcount, cfg]);

  const baseGame = rawGameId !== undefined ? getGame(rawGameId) : undefined;
  // Use the resolved variant; if the variant module is missing, getGame returns undefined
  // and the game === undefined guard below renders MinigameStub (never the base game).
  const game = resolvedGameId !== undefined ? getGame(resolvedGameId) : baseGame;

  // Build CommittedPlayer projections (id/name/stats/powerUps only)
  const committed: CommittedPlayer[] = useMemo(() => {
    if (committedBy === undefined) return [];
    return present.crew
      .filter(p => committedBy.includes(p.id))
      .map(p => ({ id: p.id, name: p.name, stats: p.stats, powerUps: p.powerUps }));
  }, [present.crew, committedBy]);

  // Compute dial from committed players' lane ratings. Higher ratings → lower level → easier.
  const dial: Difficulty = useMemo((): Difficulty => {
    if (game === undefined || resolvedGameId === undefined) return { level: 0 };
    const laneRatings = committed.flatMap(p =>
      game.lanes.map(lane => p.stats[lane]),
    );
    const level = computeDial(laneRatings, resolvedGameId, headcount, cfg);
    return { level };
  }, [committed, game, resolvedGameId, headcount, cfg]);

  // Memoise params on (rngState, resolvedGameId, dial.level): same inputs → same params.
  // Intentionally omits `game` and `dial` object from deps — dial.level is the scalar
  // that drives difficulty; the game object is stable for a given resolvedGameId.
  const params = useMemo(() => {
    if (game === undefined || resolvedGameId === undefined) return undefined;
    const rng = rngFromState(present.rngState);
    return game.generate(rng, dial);
  }, [present.rngState, resolvedGameId, dial.level]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleResolve(outcome: Outcome) {
    dispatch({ t: 'RESOLVE_MINIGAME', outcome });
  }

  // Graceful fallback for unregistered games — never a dead-end (CLAUDE.md rule 1)
  if (game === undefined || params === undefined) {
    return <MinigameStub />;
  }

  const GameComponent = game.Component;

  return (
    <div data-testid="screen-minigame">
      <DialReadout dial={dial} />
      <GameComponent
        params={params}
        dial={dial}
        committed={committed}
        onResolve={handleResolve}
      />
    </div>
  );
}
