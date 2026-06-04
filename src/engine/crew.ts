// Pure crew-level operations: gear application, stat boosts, power-ups.
// No Math.random, no mutation, no side effects.
import type { Player } from './types';
import type { GearDef } from './config';

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
