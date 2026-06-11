// Pure run state machine — exhaustive switch over the E1 RunEvent union.
// No Math.random, no timers, no DOM — all randomness via rngFromState.
// GM-override events and UNDO_LAST are E2; adding an unhandled RunEvent member
// is a compile error (the default: never assert below).
import { rngFromState } from './rng';
import type { EngineConfig } from './config';
import type { RunState, RunEvent, ScenarioRoom, PendingRoll, ResolvedRoll, Outcome } from './types';
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
import { computeGearSellValue } from './gear';

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
      // Delegate to startRun (sets up crew/mansion/quirk boosts), then generate the first room.
      const s = startRun(state, event, cfg);
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

      // Loot per outcome: clean → full option reward; complication → the larger
      // of the flat floor and a fraction of the reward (a near-miss on a big
      // room should still sting less than a botch, not pay like one);
      // botched → flat.
      const complicationLoot = Math.max(
        cfg.outcomeLoot.complication,
        Math.round(option.reward * cfg.outcomeLoot.complicationFraction),
      );
      const lootGained =
        event.outcome === 'clean' ? option.reward :
        event.outcome === 'complication' ? complicationLoot :
        cfg.outcomeLoot.botched;

      // Gear grant: fires on clean AND complication. A complication is the
      // comedic middle, not a failure — and gear is the run's only character
      // progression, so gating it behind clean-only left crews finishing the
      // night with one card. Only a botch loses the gear.
      let newEarnedGear = state.earnedGear;
      if (event.outcome !== 'botched' && option.gear !== undefined) {
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
        // Full-team games impose no exhaustion: the whole crew commits and nobody rests.
        // Regular games bench committed crew for the next room (no RNG draw).
        crew: option.fullTeam === true
          ? state.crew
          : applyExhaustion(
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
      const dc = computeDC(
        choiceDef.roll.baseDifficulty,
        laneRating,
        cfg.scenario.dcClamp,
        { heat: state.heat, roomIndex: state.roomIndex, heatDC: cfg.scenario.heatDC },
      );

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

      // Map success/failure to the Outcome taxonomy, respecting critFumble.
      const result: Outcome = success
        ? 'clean'
        : cfg.scenario.critFumble && roll === 1
          ? 'botched'
          : 'complication';

      const stateWithRoll: RunState = { ...state, rngState: nextRngState };
      // Apply and bank the effect immediately — grants are deterministic from this point.
      const next = applyScenarioEffect(stateWithRoll, effect, cfg);

      const resolvedRoll: ResolvedRoll = {
        choiceId: pendingRoll.choiceId,
        roll,
        total: roll + pendingRoll.laneRating,
        dc: pendingRoll.dc,
        lane: pendingRoll.lane,
        laneRating: pendingRoll.laneRating,
        baseDifficulty: pendingRoll.baseDifficulty,
        result,
        lootDelta: effect.lootDelta,
        heatDelta: effect.heatDelta,
        ...(effect.gear !== undefined && { gear: effect.gear }),
      };

      // Omit pendingRoll (exactOptionalPropertyTypes: spreading undefined is not allowed).
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pendingRoll: _pr, ...roomWithoutPending } = room;
      const updatedRoom: ScenarioRoom = { ...roomWithoutPending, resolvedRoll };

      const resolvedState: RunState = {
        ...next,
        currentRoom: updatedRoom,
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
        phase: 'room',
      };
      return { ...resolvedState, escapeSignal: computeEscapeSignal(resolvedState, cfg) };
    }

    case 'ACK_SCENARIO_ROLL': {
      const room = state.currentRoom;
      if (room === null || room.kind !== 'scenario') {
        throw new Error('ACK_SCENARIO_ROLL requires an active scenario room');
      }
      if (room.resolvedRoll === undefined) {
        throw new Error('ACK_SCENARIO_ROLL requires a resolvedRoll (dispatch RESOLVE_SCENARIO_ROLL first)');
      }
      const intermediate: RunState = {
        ...state,
        currentRoom: null,
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
      const { earnedGearIndex } = event;
      const earnedGear =
        earnedGearIndex !== undefined &&
        earnedGearIndex >= 0 &&
        earnedGearIndex < state.earnedGear.length
          ? [
              ...state.earnedGear.slice(0, earnedGearIndex),
              ...state.earnedGear.slice(earnedGearIndex + 1),
            ]
          : state.earnedGear;
      return {
        ...state,
        crew: state.crew.map((p, i) => (i === playerIndex ? updatedPlayer : p)),
        earnedGear,
      };
    }

    case 'SELL_GEAR': {
      if (event.index < 0 || event.index >= state.earnedGear.length) {
        throw new Error(
          `SELL_GEAR: index ${event.index} out of range (earnedGear has ${state.earnedGear.length} item(s))`,
        );
      }
      const sellValue = computeGearSellValue(state.earnedGear[event.index]!, state.roomIndex, cfg);
      return {
        ...state,
        earnedGear: [
          ...state.earnedGear.slice(0, event.index),
          ...state.earnedGear.slice(event.index + 1),
        ],
        loot: state.loot + sellValue,
      };
    }

    case 'CALL_GETAWAY': {
      return { ...state, phase: 'getaway' };
    }

    case 'GETAWAY_DITCH': {
      return { ...state, loot: Math.max(0, state.loot - cfg.getaway.ditchLootCost) };
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
