// Pure run state machine — exhaustive switch over the E1 RunEvent union.
// No Math.random, no timers, no DOM — all randomness via rngFromState.
// GM-override events and UNDO_LAST are E2; adding an unhandled RunEvent member
// is a compile error (the default: never assert below).
import { rngFromState } from './rng';
import type { EngineConfig } from './config';
import type { RunState, RunEvent } from './types';
import { startRun } from './run';
import { applyGear } from './crew';
import { generateRoom } from './generation';
import {
  obstacleDrip,
  greedySurcharge,
  outcomeHeat as outcomeHeatFn,
  applyScenarioSwing,
  escapeSignal as computeEscapeSignal,
  forcedGetaway,
} from './heat';
import { resolveGetawayOutcome } from './getaway';
import { scoreRun } from './scoring';

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
      return { ...s2, phase: 'room' };
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

      const intermediate: RunState = {
        ...state,
        heat: newHeat,
        loot: state.loot + lootGained,
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
      };
      return { ...intermediate, escapeSignal: computeEscapeSignal(intermediate, cfg) };
    }

    case 'CHOOSE_SCENARIO': {
      const room = state.currentRoom;
      if (room === null || room.kind !== 'scenario') {
        throw new Error('CHOOSE_SCENARIO requires an active scenario room');
      }
      const template = cfg.roomTemplates.scenarios.find(t => t.id === room.templateId);
      if (template === undefined) {
        throw new Error(`Scenario template "${room.templateId}" not found in config`);
      }
      const choiceConfig = template.choices.find(c => c.id === event.choiceId);
      if (choiceConfig === undefined) {
        throw new Error(
          `Choice "${event.choiceId}" not found in template "${room.templateId}"`,
        );
      }

      const newHeat = applyScenarioSwing(state.heat, choiceConfig.heatDelta);
      const lootGained = choiceConfig.lootDelta;

      const intermediate: RunState = {
        ...state,
        heat: newHeat,
        loot: state.loot + lootGained,
        history: [
          ...state.history,
          {
            kind: 'scenario',
            roomIndex: state.roomIndex,
            choiceId: event.choiceId,
            lootGained,
            heatGained: choiceConfig.heatDelta,
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
