import { useMemo } from 'react';
import { useGameStore } from '@/console/store';
import { buildRegistry } from '@/minigames';
import { rngFromState, resolveGameVariant, computeDial } from '@/engine';
import type { CommittedPlayer, Difficulty } from '@/minigames';
import type { Outcome } from '@/engine';
import { MinigameShell } from '@/minigames/primitives/MinigameShell';
import type { BoostPreviewEntry } from '@/minigames/primitives/MinigameShell';
import { MinigameStub } from './MinigameStub';

/**
 * Mini-game launcher with three-state lifecycle shell (ARMED → ACTIVE → RESOLVE).
 *
 * Resolves the committed option's gameId to a registered game module, builds
 * CommittedPlayer projections, computes the dial from committed lane ratings,
 * and memoises params from the seeded RNG.
 *
 * ARMED: shows game name, dial readout, boost-holder preview, and START CTA.
 *        The game component is NOT mounted — no timer can run on load.
 * ACTIVE (after START): mounts the game in standard zone layout.
 * RESOLVE: GM confirms the outcome → dispatches RESOLVE_MINIGAME → store sets
 *          pendingSpoils=true → PhaseRouter shows the Spoils interstitial (E13.7).
 *
 * Falls back to MinigameStub for any unregistered gameId (CLAUDE.md rule 1 — no dead-ends).
 * The launcher never mutates engine rngState; generate() draws read-only.
 */
export function MinigameHost() {
  const present = useGameStore(s => s.session.present);
  const cfg = useGameStore(s => s.cfg);
  const dispatch = useGameStore(s => s.dispatch);

  // Derive room/option/game resolution data
  const room = present.currentRoom;
  const obstacleRoom = room?.kind === 'obstacle' ? room : null;
  const committedOptionId = obstacleRoom?.committedOptionId;
  const committedBy = obstacleRoom?.committedBy;
  const option = obstacleRoom?.options.find(o => o.id === committedOptionId);
  const rawGameId: string | undefined = option?.gameId;

  const headcount = present.crew.length;
  const commitSize = committedBy?.length ?? 0;

  const resolvedGameId = useMemo((): string | undefined => {
    if (rawGameId === undefined) return undefined;
    return resolveGameVariant(rawGameId, commitSize, headcount, cfg);
  }, [rawGameId, commitSize, headcount, cfg]);

  const registry = useMemo(() => buildRegistry(cfg), [cfg]);
  const game = resolvedGameId !== undefined ? registry.find(g => g.id === resolvedGameId) : undefined;

  const committed: CommittedPlayer[] = useMemo(() => {
    if (committedBy === undefined) return [];
    return present.crew
      .filter(p => committedBy.includes(p.id))
      .map(p => ({ id: p.id, name: p.name, stats: p.stats, powerUps: p.powerUps }));
  }, [present.crew, committedBy]);

  const dial: Difficulty = useMemo((): Difficulty => {
    if (game === undefined || resolvedGameId === undefined) return { level: 0 };
    const laneRatings = committed.flatMap(p =>
      game.lanes.map(lane => p.stats[lane]),
    );
    const level = computeDial(laneRatings, resolvedGameId, headcount, cfg, { heat: present.heat, roomIndex: present.roomIndex });
    return { level };
  }, [committed, game, resolvedGameId, headcount, cfg]);

  const params = useMemo(() => {
    if (game === undefined || resolvedGameId === undefined) return undefined;
    const rng = rngFromState(present.rngState);
    return game.generate(rng, dial);
  }, [present.rngState, resolvedGameId, dial.level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Boost previews: committed players holding a relevant lane power-up
  const boostPreviews: BoostPreviewEntry[] = useMemo(() => {
    if (game === undefined) return [];
    return game.boosts.flatMap(boost => {
      const holder = committed.find(p => p.powerUps[boost.lane] === true);
      if (holder === undefined) return [];
      return [{ lane: boost.lane, label: boost.label, holderName: holder.name }];
    });
  }, [game, committed]);

  function handleShellConfirm(outcome: Outcome) {
    dispatch({ t: 'RESOLVE_MINIGAME', outcome });
  }

  // ── Graceful fallback for unregistered games (CLAUDE.md rule 1) ───────────
  if (game === undefined || params === undefined) {
    return <MinigameStub />;
  }

  const GameComponent = game.Component;
  const gameName = resolvedGameId ?? '';

  return (
    <div data-testid="screen-minigame">
      <MinigameShell
        gameName={gameName}
        dial={dial}
        boostPreviews={boostPreviews}
        onConfirm={handleShellConfirm}
      >
        {(onResolve) => (
          <GameComponent
            params={params}
            dial={dial}
            committed={committed}
            onResolve={onResolve}
          />
        )}
      </MinigameShell>
    </div>
  );
}
