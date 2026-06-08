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
} from './types';

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
    const range: [number, number] | undefined =
      headcount >= 2 ? obstacleCommitRange(template.gameId, headcount, cfg) : undefined;

    const options: [ObstacleOption, ObstacleOption] = [
      {
        id: template.options[0].id,
        gameId: template.gameId as GameId,
        greedy: template.options[0].greedy,
        heatCost: template.options[0].heatCost,
        reward: template.options[0].reward,
        ...(template.options[0].gear !== undefined && { gear: template.options[0].gear }),
        ...(range !== undefined && { commitRange: range }),
      },
      {
        id: template.options[1].id,
        gameId: template.gameId as GameId,
        greedy: template.options[1].greedy,
        heatCost: template.options[1].heatCost,
        reward: template.options[1].reward,
        ...(template.options[1].gear !== undefined && { gear: template.options[1].gear }),
        ...(range !== undefined && { commitRange: range }),
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
        isRoll: 'roll' in template.choices[0],
      },
      {
        id: template.choices[1].id,
        label: template.choices[1].label,
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
