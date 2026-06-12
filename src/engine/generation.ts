// Pure room generation functions.
// No React, no DOM, no Math.random — all randomness via the seeded RNG.

import { rngFromState } from './rng';
import { obstacleCommitRange } from './scaling';
import { applyScenarioEffect } from './scenario';
import type { EngineConfig } from './config';
import type {
  RunState,
  CarriedEffect,
  ScenarioEffect,
  ObstacleRoom,
  ScenarioRoom,
  ObstacleOption,
  ScenarioChoice,
  GameId,
  GearGrantDescriptor,
  Lane,
} from './types';

const ALL_LANES: readonly Lane[] = ['tech', 'physical', 'charm', 'stealth'];

/**
 * Roll the concrete gear drops for an option at generation time.
 *
 * Wave 3: EVERY door drops gear — guaranteed at least one — and crews bigger
 * than four roll extra drops (per-player chance, capped) so big tables get
 * more cards to share out. Wave 2 rules still apply per drop: the lane is a
 * fresh seeded draw (never the played game's lane); a drop is a power-up at
 * cfg.gearDrops.powerUpChance, else a statBoost that upgrades to the +2
 * bigScore tier at cfg.gearDrops.bigScoreChance.
 */
function rollGearDrops(
  rng: ReturnType<typeof rngFromState>,
  headcount: number,
  cfg: EngineConfig,
): GearGrantDescriptor[] {
  const { bigScoreChance, powerUpChance, extraDropChancePerPlayer, maxDrops } = cfg.gearDrops;

  let count = 1;
  for (let p = 4; p < headcount && count < maxDrops; p++) {
    if (rng.next() < extraDropChancePerPlayer) count++;
  }

  const drops: GearGrantDescriptor[] = [];
  for (let i = 0; i < count; i++) {
    const lane = rng.pick([...ALL_LANES]);
    const kind =
      rng.next() < powerUpChance
        ? 'powerUp'
        : rng.next() < bigScoreChance
          ? 'bigScore'
          : 'statBoost';
    drops.push({ kind, lane });
  }
  return drops;
}

// ── Carried-effect tick ───────────────────────────────────────────────────────

/** Result of ticking carried effects: surviving effects, fired payoffs, and per-room effects. */
export interface TickResult {
  remaining: CarriedEffect[];
  firedPayoffs: ScenarioEffect[];
  perRoomEffects: ScenarioEffect[];
}

/**
 * Tick all carried effects by one room: decrement roomsLeft, remove expired ones.
 * Effects that expire (roomsLeft reaches 0) fire their payoff (if any).
 * perRoomEffect fires on every tick, including the expiry tick.
 */
export function tickCarriedEffects(carried: readonly CarriedEffect[]): TickResult {
  const remaining: CarriedEffect[] = [];
  const firedPayoffs: ScenarioEffect[] = [];
  const perRoomEffects: ScenarioEffect[] = [];

  for (const e of carried) {
    const newRoomsLeft = e.roomsLeft - 1;
    if (e.perRoomEffect !== undefined) {
      perRoomEffects.push(e.perRoomEffect);
    }
    if (newRoomsLeft <= 0) {
      if (e.payoff !== undefined) {
        firedPayoffs.push(e.payoff);
      }
    } else {
      remaining.push({ ...e, roomsLeft: newRoomsLeft });
    }
  }

  return { remaining, firedPayoffs, perRoomEffects };
}

// ── No-repeat draw ────────────────────────────────────────────────────────────

/**
 * Draw a template ID from the given pool without repeating any ID in `usedIds`
 * until the pool is exhausted. Once exhausted, the pool resets and any template
 * may be drawn again (shuffle-deck semantics).
 *
 * Returns [chosenId, updatedUsedIds].
 */
function drawWithoutRepeat(
  rng: ReturnType<typeof rngFromState>,
  allIds: readonly string[],
  usedIds: readonly string[],
): [string, string[]] {
  const available = allIds.filter(id => !usedIds.includes(id));
  const pool = available.length > 0 ? available : [...allIds];

  const chosen = rng.pick(pool);
  const newUsed = available.length > 0 ? [...usedIds, chosen] : [chosen];
  return [chosen, newUsed];
}

// ── Room generation ───────────────────────────────────────────────────────────

/**
 * Generate the next room for the given state, advancing rngState and ticking
 * carried effects. The room type (obstacle vs scenario) is determined by a
 * seeded draw against cfg.generation.obstacleRatio.
 *
 * Does NOT advance roomIndex — the caller (reducer's PUSH_ON) does that first.
 *
 * easeNextObstacle effects only tick on obstacle rooms: they persist unchanged
 * through intervening scenario rooms until the first obstacle is reached, then
 * fire and expire. All other carried effects tick every room.
 */
export function generateRoom(state: RunState, cfg: EngineConfig): RunState {
  const rng = rngFromState(state.rngState);

  // Separate ease effects: they only tick (and expire) on obstacle rooms.
  // All other effects tick every room regardless of type.
  const easeEffects = state.carried.filter(e => e.kind === 'easeNextObstacle');
  const otherEffects = state.carried.filter(e => e.kind !== 'easeNextObstacle');

  // Tick non-ease effects; collect per-room effects and any fired payoffs.
  const { remaining: otherRemaining, firedPayoffs, perRoomEffects } = tickCarriedEffects(otherEffects);

  // Apply per-room effects first (e.g. briefcase Heat ↑ while carried), then payoffs on expiry.
  // Ease effects are included unchanged so they survive this step.
  // Payoffs/perRoomEffects may append new effects; those additions live beyond the initial slice.
  let stateAfterPayoffs: RunState = { ...state, carried: [...otherRemaining, ...easeEffects] };
  for (const perRoom of perRoomEffects) {
    stateAfterPayoffs = applyScenarioEffect(stateAfterPayoffs, perRoom, cfg);
  }
  for (const payoff of firedPayoffs) {
    stateAfterPayoffs = applyScenarioEffect(stateAfterPayoffs, payoff, cfg);
  }
  // Effects appended by perRoomEffects or payoffs — keep untouched regardless of room type.
  const payoffAddedEffects = stateAfterPayoffs.carried.slice(otherRemaining.length + easeEffects.length);

  // Choose room type via seeded RNG draw.
  const isObstacle = rng.next() < cfg.generation.obstacleRatio;

  if (isObstacle) {
    const allIds = cfg.roomTemplates.obstacles.map(t => t.id);
    const [templateId, newUsed] = drawWithoutRepeat(rng, allIds, stateAfterPayoffs.usedObstacleTemplateIds);

    const template = cfg.roomTemplates.obstacles.find(t => t.id === templateId);
    if (template === undefined) throw new Error(`obstacle template ${templateId} not found in config`);

    const headcount = stateAfterPayoffs.crew.length;
    // The room dictates the exact headcount (playtest wave 2): draw one count
    // per option from the scaling-aware legal range. Full-team games skip the
    // draw — the whole crew plays, no count applies. minCommit floors guarantee
    // Assembly Line / Defuse the Alarm never demand 1.
    const range: [number, number] | undefined =
      headcount >= 2 && template.fullTeam !== true
        ? obstacleCommitRange(template.gameId, headcount, cfg)
        : undefined;
    const counts: [number | undefined, number | undefined] =
      range !== undefined
        ? [rng.int(range[0], range[1]), rng.int(range[0], range[1])]
        : [undefined, undefined];

    // Concrete gear drops: every door pays gear (wave 3), seeded draws.
    const gearDrops: [GearGrantDescriptor[], GearGrantDescriptor[]] = [
      rollGearDrops(rng, headcount, cfg),
      rollGearDrops(rng, headcount, cfg),
    ];

    // Reward multiplier: m = 1 + perHeat*heat + perRoom*roomIndex. Defaults to 1 (no-op at 0/0).
    const { perHeat, perRoom } = cfg.rewardScale;
    const m = 1 + perHeat * stateAfterPayoffs.heat + perRoom * stateAfterPayoffs.roomIndex;

    const options: [ObstacleOption, ObstacleOption] = [
      {
        id: template.options[0].id,
        gameId: template.gameId as GameId,
        greedy: template.options[0].greedy,
        heatCost: template.options[0].heatCost,
        reward: Math.round(template.options[0].reward * m),
        gear: gearDrops[0],
        ...(counts[0] !== undefined && { commitCount: counts[0] }),
        ...(template.fullTeam === true && { fullTeam: true }),
      },
      {
        id: template.options[1].id,
        gameId: template.gameId as GameId,
        greedy: template.options[1].greedy,
        heatCost: template.options[1].heatCost,
        reward: Math.round(template.options[1].reward * m),
        gear: gearDrops[1],
        ...(counts[1] !== undefined && { commitCount: counts[1] }),
        ...(template.fullTeam === true && { fullTeam: true }),
      },
    ];

    // Ease effects fire on this obstacle: annotate the room, then tick/expire them.
    const pendingEaseSteps = easeEffects.reduce((sum) => sum + cfg.scenario.easeDialSteps, 0);
    const { remaining: easeRemaining } = tickCarriedEffects(easeEffects);

    const room: ObstacleRoom = {
      kind: 'obstacle',
      templateId,
      options,
      ...(pendingEaseSteps > 0 && { easeDialSteps: pendingEaseSteps }),
    };

    return {
      ...stateAfterPayoffs,
      carried: [...otherRemaining, ...easeRemaining, ...payoffAddedEffects],
      rngState: rng.state(),
      currentRoom: room,
      usedObstacleTemplateIds: newUsed,
    };
  } else {
    const allIds = cfg.roomTemplates.scenarios.map(t => t.id);
    const [templateId, newUsed] = drawWithoutRepeat(rng, allIds, stateAfterPayoffs.usedScenarioTemplateIds);

    const template = cfg.roomTemplates.scenarios.find(t => t.id === templateId);
    if (template === undefined) throw new Error(`scenario template ${templateId} not found in config`);

    const choices: [ScenarioChoice, ScenarioChoice] = [
      {
        id: template.choices[0].id,
        label: template.choices[0].label,
        ...(template.choices[0].flavour !== undefined && { flavour: template.choices[0].flavour }),
        isRoll: 'roll' in template.choices[0],
      },
      {
        id: template.choices[1].id,
        label: template.choices[1].label,
        ...(template.choices[1].flavour !== undefined && { flavour: template.choices[1].flavour }),
        isRoll: 'roll' in template.choices[1],
      },
    ];

    const room: ScenarioRoom = {
      kind: 'scenario',
      templateId,
      setup: template.setup,
      choices,
    };

    // Ease effects are NOT ticked on scenario rooms — stateAfterPayoffs.carried
    // already holds them unchanged and they will fire on the next obstacle.
    return {
      ...stateAfterPayoffs,
      rngState: rng.state(),
      currentRoom: room,
      usedScenarioTemplateIds: newUsed,
    };
  }
}
