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

/** Result of ticking carried effects: surviving effects and any fired payoffs. */
export interface TickResult {
  remaining: CarriedEffect[];
  firedPayoffs: ScenarioEffect[];
}

/**
 * Tick all carried effects by one room: decrement roomsLeft, remove expired ones.
 * Effects that expire (roomsLeft reaches 0) fire their payoff (if any).
 */
export function tickCarriedEffects(carried: readonly CarriedEffect[]): TickResult {
  const remaining: CarriedEffect[] = [];
  const firedPayoffs: ScenarioEffect[] = [];

  for (const e of carried) {
    const newRoomsLeft = e.roomsLeft - 1;
    if (newRoomsLeft <= 0) {
      if (e.payoff !== undefined) {
        firedPayoffs.push(e.payoff);
      }
    } else {
      remaining.push({ ...e, roomsLeft: newRoomsLeft });
    }
  }

  return { remaining, firedPayoffs };
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
 * Checks for active easeNextObstacle effects BEFORE ticking so roomsLeft=1 applies
 * to the room being generated now. Fired payoffs from expired effects are applied
 * to the state before returning.
 */
export function generateRoom(state: RunState, cfg: EngineConfig): RunState {
  const rng = rngFromState(state.rngState);

  // Check for active ease effects BEFORE tick: roomsLeft=1 means "ease this room".
  const pendingEaseSteps = state.carried
    .filter(e => e.kind === 'easeNextObstacle')
    .reduce((sum) => sum + cfg.scenario.easeDialSteps, 0);

  // Tick carried effects, collecting any fired payoffs.
  const { remaining, firedPayoffs } = tickCarriedEffects(state.carried);

  // Apply fired payoffs (e.g. briefcase Loot++ on expiry).
  let stateAfterPayoffs: RunState = { ...state, carried: remaining };
  for (const payoff of firedPayoffs) {
    stateAfterPayoffs = applyScenarioEffect(stateAfterPayoffs, payoff, cfg);
  }

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
        ...(range !== undefined && { commitRange: range }),
      },
      {
        id: template.options[1].id,
        gameId: template.gameId as GameId,
        greedy: template.options[1].greedy,
        heatCost: template.options[1].heatCost,
        reward: template.options[1].reward,
        ...(range !== undefined && { commitRange: range }),
      },
    ];

    const room: ObstacleRoom = {
      kind: 'obstacle',
      templateId,
      options,
      ...(pendingEaseSteps > 0 && { easeDialSteps: pendingEaseSteps }),
    };

    return {
      ...stateAfterPayoffs,
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

    return {
      ...stateAfterPayoffs,
      rngState: rng.state(),
      currentRoom: room,
      usedScenarioTemplateIds: newUsed,
    };
  }
}
