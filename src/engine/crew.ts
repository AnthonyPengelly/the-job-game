// Pure crew-level operations: gear application, stat boosts, power-ups, exhaustion.
// No Math.random, no mutation, no side effects.
import type { Player, PlayerId } from './types';
import type { EngineConfig, GearDef } from './config';

// ── Scaling profile helpers ───────────────────────────────────────────────────

/**
 * Resolve the scaling profile for a crew of `headcount` players.
 * Clamped to the "2".."7" keys: smaller crews use "2", larger use "7".
 */
export function profileFor(
  headcount: number,
  cfg: EngineConfig,
): EngineConfig['scaling']['profiles'][string] {
  const clamped = Math.min(7, Math.max(2, headcount));
  const profile = cfg.scaling.profiles[String(clamped)];
  if (profile === undefined) {
    throw new Error(
      `profileFor: no scaling profile for headcount ${headcount} — key "${String(clamped)}" absent from preset`,
    );
  }
  return profile;
}

/**
 * True while the player is benched (roomIndex is within their rest window).
 * `restingUntilRoom` stores the last room index where the player is resting;
 * the player is available from roomIndex `restingUntilRoom + 1`.
 */
export function isResting(player: Player, roomIndex: number): boolean {
  return player.restingUntilRoom !== undefined && roomIndex <= player.restingUntilRoom;
}

/**
 * How many rooms a committed player rests at this headcount.
 * 0 at the "tired" class (2–3 players) — nobody benches; UI copy promising
 * "whoever plays rests next room" must check this before saying it.
 */
export function restRoomsFor(headcount: number, cfg: EngineConfig): number {
  const profile = profileFor(headcount, cfg);
  return cfg.scaling.exhaustionRest[profile.exhaustion];
}

/**
 * Apply exhaustion rotation after a minigame commitment.
 * Sets `restingUntilRoom = roomIndex + exhaustionRest[class]` on committed players
 * when that rest count is > 0 (so full/light bench; tired does not bench).
 * Returns a new crew array — never mutates input.
 */
export function applyExhaustion(
  crew: Player[],
  committedIds: PlayerId[],
  roomIndex: number,
  cfg: EngineConfig,
): Player[] {
  const profile = profileFor(crew.length, cfg);
  const restRooms = cfg.scaling.exhaustionRest[profile.exhaustion];
  if (restRooms === 0) return crew;
  const committedSet = new Set<string>(committedIds);
  return crew.map(player =>
    committedSet.has(player.id)
      ? { ...player, restingUntilRoom: roomIndex + restRooms }
      : player,
  );
}

// ── Gear application ──────────────────────────────────────────────────────────

/**
 * Apply a gear item to a player, returning a new Player (no mutation).
 * - statBoost: adds magnitude to stats[lane]; boosts stack.
 * - powerUp: sets powerUps[lane] = true; idempotent if already held.
 */
export function applyGear(player: Player, def: GearDef): Player {
  if (def.kind === 'statBoost') {
    return {
      ...player,
      stats: {
        ...player.stats,
        [def.lane]: player.stats[def.lane] + def.magnitude,
      },
    };
  }
  // powerUp: idempotent — assigning again is a no-op
  return {
    ...player,
    powerUps: {
      ...player.powerUps,
      [def.lane]: true,
    },
  };
}
