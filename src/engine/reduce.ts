// Pure run state machine — exhaustive switch over the E1 RunEvent union.
// No Math.random, no timers, no DOM — all randomness via rngFromState.
// GM-override events and UNDO_LAST are E2; adding an unhandled RunEvent member
// is a compile error (the default: never assert below).
import { rngFromState } from './rng';
import type { EngineConfig } from './config';
import type { RunState, RunEvent, ScenarioRoom, PendingRoll } from './types';
import { startRun } from './run';
import { applyGear, applyExhaustion } from './crew';
import { generateRoom } from './generation';
import { applyOverride } from './overrides';
import {
  obstacleDrip,
  greedySurcharge,
  outcomeHeat as outcomeHeatFn,
  escapeSignal as computeEscapeSignal,
  forcedGetaway,
} from './heat';
import { resolveGetawayOutcome } from './getaway';
import { scoreRun } from './scoring';
import { computeDC, resolveRoll, applyScenarioEffect, resolveGearGrant } from './scenario';

/**
 * Pure reducer: (state, event, config) → next state.
 *
 * Each call reconstructs an RNG from state.rngState when it needs randomness,
 * draws, and writes the advanced state back — so the function is a pure value
 * transformer and the run replays exactly from its seed + event log.
 */
export function reduce(state: RunState, event: RunEvent, cfg: EngineConfig): RunState {
  switch (event.t) {
    case 'START_RUN': {
      // Delegate to startRun (sets up crew/mansion), then generate the first room.
      const s = startRun(state, event);
      const s2 = generateRoom(s, cfg);
      return { ...s2, phase: 'briefing' };
    }

    case 'CHOOSE_OPTION': {
      const room = state.currentRoom;
      if (room === null || room.kind !== 'obstacle') {
        throw new Error('CHOOSE_OPTION requires an active obstacle room');
      }
      return {
        ...state,
        currentRoom: {
          ...room,
          committedOptionId: event.optionId,
          committedBy: event.committed,
        },
        phase: 'minigame',
      };
    }

    case 'RESOLVE_MINIGAME': {
      const room = state.currentRoom;
      if (room === null || room.kind !== 'obstacle') {
        throw new Error('RESOLVE_MINIGAME requires an active obstacle room');
      }
      const option = room.options.find(o => o.id === room.committedOptionId);
      if (option === undefined) {
        throw new Error(
          `Committed option "${room.committedOptionId ?? '(none)'}" not found in room options`,
        );
      }

      const drip = obstacleDrip(state.roomIndex, cfg);
      const surcharge = option.greedy ? greedySurcharge(cfg) : 0;
      const outHeat = outcomeHeatFn(event.outcome, cfg);
      const heatDelta = drip + surcharge + outHeat;
      const newHeat = Math.max(0, state.heat + heatDelta);

      // Loot per reference: clean → option reward; complication/botched → tuning.outcomeLoot.
      const lootGained =
        event.outcome === 'clean' ? option.reward :
        event.outcome === 'complication' ? cfg.outcomeLoot.complication :
        cfg.outcomeLoot.botched;

      // Gear grant: fires only on clean, mirroring the reward behavior.
      let newEarnedGear = state.earnedGear;
      if (event.outcome === 'clean' && option.gear !== undefined) {
        if (option.gear.lane !== undefined) {
          const gearId = resolveGearGrant(option.gear, cfg);
          newEarnedGear = [...state.earnedGear, gearId];
        } else {
          newEarnedGear = [...state.earnedGear, option.gear];
        }
      }

      const intermediate: RunState = {
        ...state,
        heat: newHeat,
        loot: state.loot + lootGained,
        earnedGear: newEarnedGear,
        obstacleCount: state.obstacleCount + 1,
        history: [
          ...state.history,
          {
            kind: 'obstacle',
            roomIndex: state.roomIndex,
            optionId: option.id,
            outcome: event.outcome,
            lootGained,
            heatGained: heatDelta,
          },
        ],
        phase: 'offer',
        // Exhaustion rotation: bench committed crew for the next room (no RNG draw).
        crew: applyExhaustion(
          state.crew,
          room.committedBy ?? [],
          state.roomIndex,
          cfg,
        ),
      };
      return { ...intermediate, escapeSignal: computeEscapeSignal(intermediate, cfg) };
    }

    case 'CHOOSE_SCENARIO': {
      const room = state.currentRoom;
      if (room === null || room.kind !== 'scenario') {
        throw new Error('CHOOSE_SCENARIO requires an active scenario room');
      }
      const scenarioDef = cfg.roomTemplates.scenarios.find(t => t.id === room.templateId);
      if (scenarioDef === undefined) {
        throw new Error(`Scenario "${room.templateId}" not found in config`);
      }
      const choiceDef = scenarioDef.choices.find(c => c.id === event.choiceId);
      if (choiceDef === undefined) {
        throw new Error(
          `Choice "${event.choiceId}" not found in scenario "${room.templateId}"`,
        );
      }

      if ('effect' in choiceDef) {
        // No-roll choice: apply effect immediately and advance to offer.
        const next = applyScenarioEffect(state, choiceDef.effect, cfg);
        const intermediate: RunState = {
          ...next,
          history: [
            ...next.history,
            {
              kind: 'scenario',
              roomIndex: state.roomIndex,
              choiceId: event.choiceId,
              lootGained: choiceDef.effect.lootDelta,
              heatGained: choiceDef.effect.heatDelta,
            },
          ],
          phase: 'offer',
        };
        return { ...intermediate, escapeSignal: computeEscapeSignal(intermediate, cfg) };
      }

      // Roll choice: compute DC, store pendingRoll, stay in room phase awaiting the roll.
      if (event.attemptedBy === undefined) {
        throw new Error('CHOOSE_SCENARIO with a roll choice requires attemptedBy');
      }
      const player = state.crew.find(p => p.id === event.attemptedBy);
      if (player === undefined) {
        throw new Error(`Unknown player "${event.attemptedBy ?? ''}" in CHOOSE_SCENARIO`);
      }
      const laneRating = player.stats[choiceDef.roll.lane];
      const dc = computeDC(choiceDef.roll.baseDifficulty, laneRating, cfg.scenario.dcClamp);

      const pendingRoll: PendingRoll = {
        choiceId: event.choiceId,
        attemptedBy: event.attemptedBy,
        lane: choiceDef.roll.lane,
        laneRating,
        baseDifficulty: choiceDef.roll.baseDifficulty,
        dc,
      };

      const updatedRoom: ScenarioRoom = { ...room, pendingRoll };
      return { ...state, currentRoom: updatedRoom };
    }

    case 'RESOLVE_SCENARIO_ROLL': {
      const room = state.currentRoom;
      if (room === null || room.kind !== 'scenario') {
        throw new Error('RESOLVE_SCENARIO_ROLL requires an active scenario room');
      }
      const { pendingRoll } = room;
      if (pendingRoll === undefined) {
        throw new Error('RESOLVE_SCENARIO_ROLL requires a pending roll (dispatch CHOOSE_SCENARIO first)');
      }
      const scenarioDef = cfg.roomTemplates.scenarios.find(t => t.id === room.templateId);
      if (scenarioDef === undefined) {
        throw new Error(`Scenario "${room.templateId}" not found in config`);
      }
      const choiceDef = scenarioDef.choices.find(c => c.id === pendingRoll.choiceId);
      if (choiceDef === undefined || !('roll' in choiceDef)) {
        throw new Error(`Roll choice "${pendingRoll.choiceId}" not found in scenario "${room.templateId}"`);
      }

      // Use external roll when supplied (physical dice mode), else draw from seeded RNG.
      let roll: number;
      let nextRngState = state.rngState;
      if (event.externalRoll !== undefined) {
        roll = event.externalRoll;
      } else {
        const rng = rngFromState(state.rngState);
        roll = rng.int(1, 20);
        nextRngState = rng.state();
      }

      const success = resolveRoll(roll, pendingRoll.dc, cfg.scenario.critFumble);
      const effect = success ? choiceDef.roll.success : choiceDef.roll.failure;

      const stateWithRoll: RunState = { ...state, rngState: nextRngState };
      const next = applyScenarioEffect(stateWithRoll, effect, cfg);

      const intermediate: RunState = {
        ...next,
        currentRoom: null,
        history: [
          ...next.history,
          {
            kind: 'scenario',
            roomIndex: state.roomIndex,
            choiceId: pendingRoll.choiceId,
            lootGained: effect.lootDelta,
            heatGained: effect.heatDelta,
            roll,
            dc: pendingRoll.dc,
            success,
          },
        ],
        phase: 'offer',
      };
      return { ...intermediate, escapeSignal: computeEscapeSignal(intermediate, cfg) };
    }

    case 'PUSH_ON': {
      const newRoomIndex = state.roomIndex + 1;
      const intermediate: RunState = { ...state, roomIndex: newRoomIndex };
      if (forcedGetaway(intermediate.heat, cfg)) {
        return { ...intermediate, phase: 'getaway' };
      }
      // generateRoom ticks carried effects and advances rngState.
      const next = generateRoom(intermediate, cfg);
      return { ...next, phase: 'room' };
    }

    case 'ASSIGN_GEAR': {
      const def = cfg.gear[event.gear];
      if (def === undefined) {
        throw new Error(`Unknown gear id "${event.gear}"`);
      }
      const playerIndex = state.crew.findIndex(p => p.id === event.to);
      if (playerIndex === -1) {
        throw new Error(`Unknown player id "${event.to}"`);
      }
      const updatedPlayer = applyGear(state.crew[playerIndex]!, def);
      return {
        ...state,
        crew: state.crew.map((p, i) => (i === playerIndex ? updatedPlayer : p)),
      };
    }

    case 'CALL_GETAWAY': {
      return { ...state, phase: 'getaway' };
    }

    case 'GETAWAY_DITCH': {
      const newHeat = Math.min(cfg.heat.hMax, state.heat + cfg.getaway.ditchHeatCost);
      return { ...state, heat: newHeat };
    }

    case 'OVERRIDE_SET_HEAT':
    case 'OVERRIDE_ADJUST_HEAT':
    case 'OVERRIDE_SET_LOOT':
    case 'OVERRIDE_ADJUST_LOOT':
    case 'OVERRIDE_SET_STAT':
    case 'OVERRIDE_ADJUST_STAT':
    case 'OVERRIDE_SET_POWERUP':
    case 'OVERRIDE_SET_RESTING':
    case 'OVERRIDE_REROLL_ROOM':
    case 'OVERRIDE_SKIP_ROOM':
    case 'OVERRIDE_SET_PHASE': {
      return applyOverride(state, event, cfg);
    }

    case 'RESOLVE_GETAWAY': {
      if (event.win !== undefined) {
        // E6 seam: caller supplies the outcome from real Articulate cards/timer.
        const win = event.win;
        return {
          ...state,
          win,
          finalScore: scoreRun(state.loot, state.heat, win, cfg),
          phase: 'result',
        };
      }
      // Seeded roll: reconstruct RNG, draw once, write back advanced state.
      const rng = rngFromState(state.rngState);
      const roll = rng.next();
      const win = resolveGetawayOutcome(state, cfg, { roll });
      return {
        ...state,
        rngState: rng.state(),
        win,
        finalScore: scoreRun(state.loot, state.heat, win, cfg),
        phase: 'result',
      };
    }

    default: {
      // Exhaustiveness: adding an unhandled RunEvent member is a compile error.
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
