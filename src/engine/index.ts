// Engine layer — pure TS, no React, no DOM, no Math.random.
// EngineLayer kept for backward-compat with the E0 smoke test.
export type EngineLayer = 'engine';

export { mulberry32, rngFromState } from './rng';
export type { Rng } from './rng';

export { initialState, startRun } from './run';

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
  ScenarioRoom,
  CurrentRoom,
  CarriedEffect,
  RoomResult,
  MansionDressing,
  RunState,
  RunEvent,
  Skill,
} from './types';
