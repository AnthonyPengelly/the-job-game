// Harness-only crew policy. NOT a preset field, NOT in src/engine.
// Port of heat-model-simulation.py SKILL bands, growth_bonus, player_bonus,
// and the model-crew decision policy that drives the shipping reduce().
import { greedyAvailable, forcedGetaway } from '@/engine/heat';
import { getawayOdds } from '@/engine/getaway';
import type { Rng } from '@/engine/rng';
import type { EngineConfig } from '@/engine/config';
import type { RunState, RunEvent, Skill, ObstacleRoom, ScenarioChoiceDef } from '@/engine/types';

/** Expected heat delta for a choice: effect's delta, or average of success/failure for rolls. */
function choiceHeatDelta(c: ScenarioChoiceDef): number {
  if ('effect' in c) return c.effect.heatDelta;
  return (c.roll.success.heatDelta + c.roll.failure.heatDelta) / 2;
}

/** Expected loot delta for a choice: effect's delta, or average of success/failure for rolls. */
function choiceLootDelta(c: ScenarioChoiceDef): number {
  if ('effect' in c) return c.effect.lootDelta;
  return (c.roll.success.lootDelta + c.roll.failure.lootDelta) / 2;
}

// Python: SKILL = {'bad': 0.45, 'avg': 0.65, 'good': 0.82}
export const SKILL_VALUES: Record<Skill, number> = {
  bad: 0.45,
  avg: 0.65,
  good: 0.82,
};

// Python: {2:-0.04,3:-0.02,4:0.0,5:0.02,7:0.05}.get(n,0.0)
export function playerBonus(n: number): number {
  const table: Record<number, number> = { 2: -0.04, 3: -0.02, 4: 0.0, 5: 0.02, 7: 0.05 };
  return table[n] ?? 0.0;
}

// Python: min(0.12, 0.015*i) — caller passes roomIndex+1 (Python room is 1-indexed)
export function growthBonus(room: number): number {
  return Math.min(0.12, 0.015 * room);
}

// Port of Python's outcome(rng, p): uses 2 RNG draws on success, 2 on failure.
function rollOutcome(rng: Rng, p: number): 'clean' | 'complication' | 'botched' {
  if (rng.next() < p) {
    return rng.next() < 0.7 ? 'clean' : 'complication';
  }
  return rng.next() < 0.4 ? 'complication' : 'botched';
}

// Port of Python's scenario branch: picks a choice id from the active scenario room.
// Hot scenario (H > 0.6*HMAX): prefer cooling.
// Normal scenario: prefer loot, with p-driven fallback to heat.
function pickScenarioChoiceId(
  state: RunState,
  rng: Rng,
  p: number,
  cfg: EngineConfig,
): string {
  const room = state.currentRoom;
  if (room === null || room.kind !== 'scenario') {
    throw new Error('pickScenarioChoiceId: expected scenario room');
  }
  const template = cfg.roomTemplates.scenarios.find(t => t.id === room.templateId);
  if (template === undefined) {
    throw new Error(`pickScenarioChoiceId: template not found: ${room.templateId}`);
  }

  const [t0, t1] = template.choices;
  const [c0, c1] = room.choices;

  // Identify cooling (lower expected heatDelta) and heating (higher) choices.
  const h0 = choiceHeatDelta(t0);
  const h1 = choiceHeatDelta(t1);
  const l0 = choiceLootDelta(t0);
  const l1 = choiceLootDelta(t1);

  const coolIsIdx0 = h0 <= h1;
  const coolId = coolIsIdx0 ? c0.id : c1.id;
  const heatId = coolIsIdx0 ? c1.id : c0.id;

  // Loot-leaning choice: higher expected lootDelta; tiebreak: cooling (safer).
  const lootIsIdx0 = l0 > l1 ? true : l1 > l0 ? false : coolIsIdx0;
  const lootId = lootIsIdx0 ? c0.id : c1.id;

  const isHot = state.heat > 0.6 * cfg.heat.hMax;

  if (isHot) {
    // Python: 50% → cool; else p→cool, (1-p)→heat
    if (rng.next() < 0.5) return coolId;
    return rng.next() < p ? coolId : heatId;
  } else {
    // Python: 70% → loot branch; 30% → p→loot, (1-p)→heat
    if (rng.next() < 0.7) return lootId;
    return rng.next() < p ? lootId : heatId;
  }
}

/**
 * Given the current RunState, return the next event for the model crew to dispatch.
 * Reproduces the branching of heat-model-simulation.py run_once():
 *   obstacle: greedy while heat < 0.5*hMax; outcome from p with -0.1 greedy penalty
 *   scenario: cool/loot branches per Python
 *   offer:    escape when escapeSignal or forced; safety cap at roomIndex >= 39 (~room 40)
 *   getaway:  RESOLVE_GETAWAY with no win override — engine's seeded RNG decides
 */
export function nextModelEvent(
  state: RunState,
  rng: Rng,
  skill: Skill,
  cfg: EngineConfig,
): RunEvent {
  // p = min(0.95, base + growth_bonus(room)) — Python room is 1-indexed → roomIndex+1
  const base = SKILL_VALUES[skill] + playerBonus(state.crew.length);
  const p = Math.min(0.95, base + growthBonus(state.roomIndex + 1));

  switch (state.phase) {
    case 'briefing': {
      // START_RUN lands here with room 0 already generated. Mirror the Briefing screen's
      // "Begin" button: just flip phase to 'room' so the loop can proceed.
      return { t: 'OVERRIDE_SET_PHASE', phase: 'room' };
    }

    case 'room': {
      const room = state.currentRoom;
      if (room === null) throw new Error('nextModelEvent: room phase but no currentRoom');

      if (room.kind === 'obstacle') {
        const wantGreedy = greedyAvailable(state.heat, cfg);
        const preferred = room.options.find(o => o.greedy === wantGreedy);
        const fallback = room.options[0];
        if (fallback === undefined) throw new Error('nextModelEvent: obstacle has no options');
        const option = preferred ?? fallback;
        return {
          t: 'CHOOSE_OPTION',
          optionId: option.id,
          committed: state.crew.map(pl => pl.id),
        };
      } else {
        // If pendingRoll is set, we already chose; resolve the roll now.
        if (room.pendingRoll !== undefined) {
          return { t: 'RESOLVE_SCENARIO_ROLL' };
        }
        const choiceId = pickScenarioChoiceId(state, rng, p, cfg);
        const template = cfg.roomTemplates.scenarios.find(t => t.id === room.templateId);
        const choiceDef = template?.choices.find(c => c.id === choiceId);
        const isRollChoice = choiceDef !== undefined && 'roll' in choiceDef;
        if (isRollChoice && state.crew.length > 0) {
          // For roll choices, the first available player attempts it.
          return { t: 'CHOOSE_SCENARIO', choiceId, attemptedBy: state.crew[0]!.id };
        }
        return { t: 'CHOOSE_SCENARIO', choiceId };
      }
    }

    case 'minigame': {
      // In minigame phase, currentRoom is always an obstacle with committedOptionId set.
      const room = state.currentRoom as ObstacleRoom;
      const option = room.options.find(o => o.id === room.committedOptionId);
      if (option === undefined) throw new Error('nextModelEvent: committed option not found');
      const outcome = rollOutcome(rng, p - (option.greedy ? 0.1 : 0));
      return { t: 'RESOLVE_MINIGAME', outcome };
    }

    case 'offer': {
      // Escape if: signal set, forced getaway (heat >= hMax), or safety cap (40 rooms max)
      if (state.escapeSignal || forcedGetaway(state.heat, cfg) || state.roomIndex >= 39) {
        return { t: 'CALL_GETAWAY' };
      }
      return { t: 'PUSH_ON' };
    }

    case 'getaway': {
      // Use the win seam to inject skill-aware Getaway resolution.
      // The engine's default crewSkill is skillPivot (0.65, mediocre baseline for E1),
      // but the harness knows the actual skill band and must pass it so skill separates
      // win rates — matching Python's getaway(H, cfg, n, SKILL[skill]).
      const odds = getawayOdds(state.heat, cfg, state.crew.length, SKILL_VALUES[skill]);
      return { t: 'RESOLVE_GETAWAY', win: rng.next() < odds };
    }

    default: {
      throw new Error(`nextModelEvent: unexpected phase "${state.phase}"`);
    }
  }
}
