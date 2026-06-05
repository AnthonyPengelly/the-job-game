// Pure scenario roll-resolution functions.
// No React, no DOM, no Math.random — all randomness via the seeded RNG.
import { applyScenarioSwing } from './heat';
import type { EngineConfig } from './config';
import type {
  RunState,
  ScenarioEffect,
  GearGrantDescriptor,
  GearId,
  CarriedEffect,
} from './types';

// ── DC computation ────────────────────────────────────────────────────────────

/**
 * DC = baseDifficulty − laneRating, clamped to dcClamp (default [1, 20]).
 * Higher laneRating lowers the DC, making success more likely.
 */
export function computeDC(
  baseDifficulty: number,
  laneRating: number,
  dcClamp: [number, number],
): number {
  const raw = baseDifficulty - laneRating;
  return Math.max(dcClamp[0], Math.min(dcClamp[1], raw));
}

/**
 * Probability of success: (21 − DC) / 20.
 * DC=1 → 100%, DC=11 → 50%, DC=20 → 5%.
 */
export function successOdds(dc: number): number {
  return (21 - dc) / 20;
}

/**
 * Resolve a d20 roll against a DC.
 * When critFumble is true: nat-20 always succeeds, nat-1 always fails (before DC check).
 */
export function resolveRoll(roll: number, dc: number, critFumble: boolean): boolean {
  if (critFumble && roll === 20) return true;
  if (critFumble && roll === 1) return false;
  return roll >= dc;
}

// ── Gear resolution ───────────────────────────────────────────────────────────

/**
 * Resolve a GearGrantDescriptor to a GearId from cfg.gear.
 * For multi-lane descriptors (lanes), picks the first matching gear found.
 * Throws if no matching gear exists in the catalog (fail loudly at the boundary).
 */
function resolveGearGrant(descriptor: GearGrantDescriptor, cfg: EngineConfig): GearId {
  const targetLanes =
    descriptor.lane !== undefined ? [descriptor.lane] : (descriptor.lanes ?? []);
  const targetKind = descriptor.kind === 'bigScore' ? 'statBoost' : descriptor.kind;
  const targetMagnitude = descriptor.kind === 'bigScore' ? 2 : 1;

  for (const lane of targetLanes) {
    for (const [gearId, def] of Object.entries(cfg.gear)) {
      if (def.kind !== targetKind || def.lane !== lane) continue;
      if (def.kind === 'statBoost' && def.magnitude === targetMagnitude) {
        return gearId as GearId;
      }
      if (def.kind === 'powerUp') {
        return gearId as GearId;
      }
    }
  }

  throw new Error(
    `applyScenarioEffect: no gear in catalog matching descriptor ${JSON.stringify(descriptor)}`,
  );
}

// ── Effect application ────────────────────────────────────────────────────────

/**
 * Apply a ScenarioEffect to the run state, resolving all five currencies:
 *   Heat  → applyScenarioSwing (clamped at 0)
 *   Loot  → direct add
 *   Gear  → resolved GearId pushed onto earnedGear pool
 *   info  → easeNextObstacle CarriedEffect with roomsLeft=1
 *   delayed → CarriedEffect with payoff that fires on expiry
 *
 * Pure: no RNG draws, no mutations, no side effects.
 */
export function applyScenarioEffect(
  state: RunState,
  effect: ScenarioEffect,
  cfg: EngineConfig,
): RunState {
  let next = state;

  // Heat
  if (effect.heatDelta !== 0) {
    next = { ...next, heat: applyScenarioSwing(next.heat, effect.heatDelta) };
  }

  // Loot
  if (effect.lootDelta !== 0) {
    next = { ...next, loot: next.loot + effect.lootDelta };
  }

  // Gear
  if (effect.gear !== undefined) {
    const gearId = resolveGearGrant(effect.gear, cfg);
    next = { ...next, earnedGear: [...next.earnedGear, gearId] };
  }

  // Info (ease the next obstacle's dial by cfg.scenario.easeDialSteps)
  if (effect.info === true) {
    const easeEffect: CarriedEffect = {
      id: `ease-${next.roomIndex}-${next.carried.length}`,
      kind: 'easeNextObstacle',
      roomsLeft: 1,
    };
    next = { ...next, carried: [...next.carried, easeEffect] };
  }

  // Delayed payoff (e.g. briefcase → Loot++ after N rooms)
  if (effect.delayed !== undefined) {
    const delayedEffect: CarriedEffect = {
      id: `delayed-${next.roomIndex}-${next.carried.length}`,
      kind: effect.delayed.kind,
      roomsLeft: effect.delayed.roomsLeft,
      payoff: effect.delayed.payoff,
    };
    next = { ...next, carried: [...next.carried, delayedEffect] };
  }

  return next;
}
