// Engine layer — pure TS, no React, no DOM, no Math.random.
// EngineLayer kept for backward-compat with the E0 smoke test.
export type EngineLayer = 'engine';

export type { EngineConfig, GearDef } from './config';

export { mulberry32, rngFromState } from './rng';
export type { Rng } from './rng';

export { initialState, startRun } from './run';

export {
  obstacleDrip,
  greedyAvailable,
  greedySurcharge,
  outcomeHeat,
  applyScenarioSwing,
  escapeSignal,
  forcedGetaway,
} from './heat';

export { getawayOdds, resolveGetawayOutcome, getawayBrief } from './getaway';

export { scoreRun } from './scoring';

export { generateRoom, tickCarriedEffects } from './generation';

export { applyGear, profileFor, isResting, applyExhaustion, restRoomsFor } from './crew';

export { obstacleCommitRange, resolveGameVariant, computeDial } from './scaling';

export { applyOverride } from './overrides';

export { computeGearSellValue } from './gear';

export { reduce } from './reduce';

export { reduceSession, initialSession } from './history';
export type { SessionState, SessionEvent } from './history';

export type {
  Lane,
  Outcome,
  RunPhase,
  MansionType,
  PlayerId,
  GearId,
  GameId,
  QuirkId,
  Player,
  PlayerSetup,
  ObstacleOption,
  ObstacleRoom,
  ScenarioChoice,
  ScenarioChoiceDef,
  ScenarioRoom,
  CurrentRoom,
  CarriedEffect,
  RoomResult,
  MansionDressing,
  RunState,
  RunEvent,
  OverrideEvent,
  Skill,
} from './types';
