import { useMemo, useState } from 'react';
import { useGameStore } from '@/console/store';
import { buildRegistry } from '@/minigames';
import { rngFromState, resolveGameVariant, computeDial } from '@/engine';
import type { CommittedPlayer, Difficulty } from '@/minigames';
import type { Outcome } from '@/engine';
import { DialReadout } from '@/minigames/primitives/DialReadout';
import { Teleprompter } from '@/console/teleprompter';
import { MinigameStub } from './MinigameStub';

/**
 * Mini-game launcher: resolves the committed option's gameId to a registered
 * game module, builds CommittedPlayer projections, computes the dial from
 * committed lane ratings, and memoises params from the seeded RNG.
 *
 * Falls back to MinigameStub for any unregistered gameId (CLAUDE.md rule 1 — no dead-ends).
 * The launcher never mutates engine rngState; generate() draws read-only.
 *
 * After a registered game resolves: if a narration director is available, an
 * outcomeQuip is shown via Teleprompter before the RESOLVE_MINIGAME dispatch.
 * The GM can advance the quip or confirm immediately — no dead-end.
 */
export function MinigameHost() {
  const present = useGameStore(s => s.session.present);
  const cfg = useGameStore(s => s.cfg);
  const dispatch = useGameStore(s => s.dispatch);
  const director = useGameStore(s => s.director);

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

  const registry = useMemo(() => buildRegistry(cfg), [cfg]);
  const game = resolvedGameId !== undefined ? registry.find(g => g.id === resolvedGameId) : undefined;

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

  // Outcome quip: set when a registered game resolves and a director is available.
  const [pendingOutcome, setPendingOutcome] = useState<Outcome | null>(null);
  const [quipLine, setQuipLine] = useState<string>('');

  function handleResolve(outcome: Outcome) {
    if (director !== null) {
      const line = director.next('outcomeQuip', { outcome });
      setQuipLine(line);
      setPendingOutcome(outcome);
    } else {
      dispatch({ t: 'RESOLVE_MINIGAME', outcome });
    }
  }

  function handleConfirmOutcome() {
    if (pendingOutcome !== null) {
      dispatch({ t: 'RESOLVE_MINIGAME', outcome: pendingOutcome });
    }
  }

  function handleQuipAdvance() {
    if (pendingOutcome !== null && director !== null) {
      setQuipLine(director.next('outcomeQuip', { outcome: pendingOutcome }));
    }
  }

  // Outcome quip screen: shown after a registered game resolves (director available only).
  if (pendingOutcome !== null) {
    return (
      <div data-testid="screen-minigame">
        <div data-testid="outcome-quip">
          <Teleprompter line={quipLine} onAdvance={handleQuipAdvance} />
        </div>
        <button data-testid="btn-confirm-outcome" onClick={handleConfirmOutcome}>
          Continue
        </button>
        <button data-testid="btn-back-outcome" onClick={() => setPendingOutcome(null)}>
          Back
        </button>
      </div>
    );
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
