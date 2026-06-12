import { useMemo } from 'react';
import { useGameStore } from '@/console/store';
import { useAudio } from '@/console/audio';
import { buildRegistry } from '@/minigames';
import {
  rngFromState,
  resolveGameVariant,
  computeDial,
  obstacleDrip,
  greedySurcharge,
  outcomeHeat,
} from '@/engine';
import type { CommittedPlayer, Difficulty } from '@/minigames';
import type { Outcome } from '@/engine';
import { MinigameShell } from '@/minigames/primitives/MinigameShell';
import type { BoostPreviewEntry, OutcomeConsequence } from '@/minigames/primitives';
import { formatLoot } from '@/content/format';
import { MinigameStub } from './MinigameStub';

/** Manifest sting cue per confirmed outcome (auto-fired on GM confirm). */
const OUTCOME_STING: Record<Outcome, string> = {
  clean: 'sting-clean',
  complication: 'sting-complication',
  botched: 'sting-botch',
};

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
  const audio = useAudio();

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
  }, [committed, game, resolvedGameId, headcount, cfg, present.heat, present.roomIndex]);

  const params = useMemo(() => {
    if (game === undefined || resolvedGameId === undefined) return undefined;
    const rng = rngFromState(present.rngState);
    return game.generate(rng, dial);
  }, [present.rngState, resolvedGameId, dial.level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Boost previews: EVERY committed player holding a power-up in any of the
  // game's lanes gets a tag — two eligible holders means two names shown
  // (the ability still fires once per game, but either may shout it).
  const boostPreviews: BoostPreviewEntry[] = useMemo(() => {
    if (game === undefined) return [];
    return game.boosts.flatMap(boost => {
      const holders = committed.filter(p => game.lanes.some(l => p.powerUps[l] === true));
      return holders.map(holder => ({ lane: boost.lane, label: boost.label, holderName: holder.name }));
    });
  }, [game, committed]);

  // What confirming each tier will do — mirrors the RESOLVE_MINIGAME maths in
  // reduce.ts so the confirm moment shows honest numbers. Recompute is cheap.
  const consequences = useMemo((): Partial<Record<Outcome, OutcomeConsequence>> | undefined => {
    if (option === undefined) return undefined;
    const drip = obstacleDrip(present.roomIndex, cfg);
    const surcharge = option.greedy ? greedySurcharge(cfg) : 0;
    const complicationLoot = Math.max(
      cfg.outcomeLoot.complication,
      Math.round(option.reward * cfg.outcomeLoot.complicationFraction),
    );
    const hasGear = option.gear !== undefined;
    function tier(o: Outcome, loot: number, gearKept: boolean): OutcomeConsequence {
      return {
        heatDelta: drip + surcharge + outcomeHeat(o, cfg),
        lootLabel: loot > 0 ? `+${formatLoot(loot)}` : formatLoot(loot),
        ...(hasGear ? { gearNote: gearKept ? 'Drop kept' : 'Drop lost' } : {}),
      };
    }
    return {
      clean: tier('clean', option.reward, true),
      complication: tier('complication', complicationLoot, true),
      botched: tier('botched', cfg.outcomeLoot.botched, false),
    };
  }, [option, present.roomIndex, cfg]);

  function handleShellConfirm(outcome: Outcome) {
    // The sting is the confirm's exclamation point — automatic, manual
    // soundboard cues stay available as overrides.
    audio?.engine.play(OUTCOME_STING[outcome]);
    dispatch({ t: 'RESOLVE_MINIGAME', outcome });
  }

  // ── Graceful fallback for unregistered games (CLAUDE.md rule 1) ───────────
  if (game === undefined || params === undefined) {
    return <MinigameStub />;
  }

  const GameComponent = game.Component;
  const gameName = game.name ?? resolvedGameId ?? '';

  return (
    <div data-testid="screen-minigame">
      <MinigameShell
        gameName={gameName}
        {...(game.armedInstructions !== undefined && { instructions: game.armedInstructions })}
        dial={dial}
        boostPreviews={boostPreviews}
        onConfirm={handleShellConfirm}
        {...(consequences !== undefined && { consequences })}
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
