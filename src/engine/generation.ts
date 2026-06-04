// Pure room generation functions.
// No React, no DOM, no Math.random — all randomness via the seeded RNG.
// E2/E5/E7 note: minCommit/variant/excluded-from-solo filtering and the real
// 44 scenarios are later epics. E1 generation is the seeded structural stream only.

import { rngFromState } from './rng';
import type { EngineConfig } from './config';
import type {
  RunState,
  CarriedEffect,
  ObstacleRoom,
  ScenarioRoom,
  ObstacleOption,
  ScenarioChoice,
  GameId,
} from './types';

/**
 * Tick all carried effects by one room: decrement roomsLeft, remove expired ones.
 * Effects that reach roomsLeft <= 0 are considered fired/expired and dropped.
 * Side-effect behaviour (beyond expiry) is deferred to later epics.
 */
export function tickCarriedEffects(carried: readonly CarriedEffect[]): CarriedEffect[] {
  return carried
    .map(e => ({ ...e, roomsLeft: e.roomsLeft - 1 }))
    .filter(e => e.roomsLeft > 0);
}

/**
 * Draw a template ID from the given pool without repeating any ID in `usedIds`
 * until the pool is exhausted. Once exhausted, the pool resets and any template
 * may be drawn again (shuffle-deck semantics).
 *
 * Returns [chosenId, updatedUsedIds, advancedRng].
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

/**
 * Generate the next room for the given state, advancing rngState and ticking
 * carried effects. The room type (obstacle vs scenario) is determined by a
 * seeded draw against cfg.generation.obstacleRatio.
 *
 * Does NOT advance roomIndex — the caller (reducer's PUSH_ON) does that first.
 * Does tick carried effects — call this after roomIndex is already incremented.
 */
export function generateRoom(state: RunState, cfg: EngineConfig): RunState {
  const rng = rngFromState(state.rngState);

  // Tick carried effects first (deterministic, no RNG draw needed).
  const newCarried = tickCarriedEffects(state.carried);

  // Choose room type via seeded RNG draw.
  const isObstacle = rng.next() < cfg.generation.obstacleRatio;

  if (isObstacle) {
    const allIds = cfg.roomTemplates.obstacles.map(t => t.id);
    const [templateId, newUsed] = drawWithoutRepeat(rng, allIds, state.usedObstacleTemplateIds);

    const template = cfg.roomTemplates.obstacles.find(t => t.id === templateId);
    // template is always found: templateId came from the same allIds array.
    if (template === undefined) throw new Error(`obstacle template ${templateId} not found in config`);

    const options: [ObstacleOption, ObstacleOption] = [
      {
        id: template.options[0].id,
        gameId: template.gameId as GameId,
        greedy: template.options[0].greedy,
        heatCost: template.options[0].heatCost,
        reward: template.options[0].reward,
      },
      {
        id: template.options[1].id,
        gameId: template.gameId as GameId,
        greedy: template.options[1].greedy,
        heatCost: template.options[1].heatCost,
        reward: template.options[1].reward,
      },
    ];

    const room: ObstacleRoom = {
      kind: 'obstacle',
      templateId,
      options,
    };

    return {
      ...state,
      rngState: rng.state(),
      currentRoom: room,
      carried: newCarried,
      usedObstacleTemplateIds: newUsed,
    };
  } else {
    const allIds = cfg.roomTemplates.scenarios.map(t => t.id);
    const [templateId, newUsed] = drawWithoutRepeat(rng, allIds, state.usedScenarioTemplateIds);

    const template = cfg.roomTemplates.scenarios.find(t => t.id === templateId);
    if (template === undefined) throw new Error(`scenario template ${templateId} not found in config`);

    const choices: [ScenarioChoice, ScenarioChoice] = [
      { id: template.choices[0].id, label: template.choices[0].label },
      { id: template.choices[1].id, label: template.choices[1].label },
    ];

    const room: ScenarioRoom = {
      kind: 'scenario',
      templateId,
      choices,
    };

    return {
      ...state,
      rngState: rng.state(),
      currentRoom: room,
      carried: newCarried,
      usedScenarioTemplateIds: newUsed,
    };
  }
}
