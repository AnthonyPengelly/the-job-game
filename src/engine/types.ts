// Pure domain model for The Job engine.
// No logic here — only types. All engine code imports from this file.

// ── Core value types ──────────────────────────────────────────────────────────

export type Lane = 'tech' | 'physical' | 'charm' | 'stealth';

export type Outcome = 'clean' | 'complication' | 'botched';

export type RunPhase = 'briefing' | 'room' | 'minigame' | 'offer' | 'getaway' | 'result';

export type MansionType = 'villa' | 'estate' | 'penthouse';

// ── Branded IDs ───────────────────────────────────────────────────────────────

export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type GearId = string & { readonly __brand: 'GearId' };
export type GameId = string & { readonly __brand: 'GameId' };
export type QuirkId = string & { readonly __brand: 'QuirkId' };

// ── Player ────────────────────────────────────────────────────────────────────

export interface Player {
  id: PlayerId;
  name: string;
  stats: Record<Lane, number>;
  powerUps: Partial<Record<Lane, boolean>>;
  quirk?: QuirkId;
  restingUntilRoom?: number;
}

/** Payload inside a START_RUN event — what the GM enters for each player. */
export interface PlayerSetup {
  name: string;
  quirk?: QuirkId;
}

// ── Room types ────────────────────────────────────────────────────────────────

export interface ObstacleOption {
  id: string;
  gameId: GameId;
  greedy: boolean;
  heatCost: number;
  reward: number;
  /** Scaling-aware [minCrew, maxCrew] commit range for the current headcount. Set by generateRoom when crew ≥ 2. */
  commitRange?: [number, number];
}

export interface ObstacleRoom {
  kind: 'obstacle';
  templateId: string;
  options: ObstacleOption[];
  committedOptionId?: string;
  committedBy?: PlayerId[];
}

export interface ScenarioChoice {
  id: string;
  label: string;
}

export interface ScenarioRoom {
  kind: 'scenario';
  templateId: string;
  choices: [ScenarioChoice, ScenarioChoice];
}

export type CurrentRoom = ObstacleRoom | ScenarioRoom;

// ── Carried effects ───────────────────────────────────────────────────────────

/** A timed effect that ticks down each room (e.g. briefcase countdown). */
export interface CarriedEffect {
  id: string;
  kind: string;
  roomsLeft: number;
}

// ── History ───────────────────────────────────────────────────────────────────

export type RoomResult =
  | {
      kind: 'obstacle';
      roomIndex: number;
      optionId: string;
      outcome: Outcome;
      lootGained: number;
      heatGained: number;
    }
  | {
      kind: 'scenario';
      roomIndex: number;
      choiceId: string;
      lootGained: number;
      heatGained: number;
    };

// ── Mansion dressing ──────────────────────────────────────────────────────────

export interface MansionDressing {
  type: MansionType;
}

// ── Run state ─────────────────────────────────────────────────────────────────

export interface RunState {
  seed: number;
  /** Current mulberry32 internal state word — advanced by every RNG draw. */
  rngState: number;
  phase: RunPhase;
  heat: number;
  loot: number;
  crew: Player[];
  roomIndex: number;
  obstacleCount: number;
  currentRoom: CurrentRoom | null;
  carried: CarriedEffect[];
  history: RoomResult[];
  escapeSignal: boolean;
  mansion: MansionDressing;
  finalScore?: number;
  win?: boolean;
  /** Obstacle template IDs drawn this run — reset when the pool is exhausted. */
  usedObstacleTemplateIds: string[];
  /** Scenario template IDs drawn this run — reset when the pool is exhausted. */
  usedScenarioTemplateIds: string[];
}

// ── GM-override events (E2.5) ─────────────────────────────────────────────────
// The GM can drive any tracked field to any legal value at any time (no dead-ends).
// All overrides are handled in overrides.ts and delegated to from reduce's switch.

export type OverrideEvent =
  | { t: 'OVERRIDE_SET_HEAT'; value: number }
  | { t: 'OVERRIDE_ADJUST_HEAT'; delta: number }
  | { t: 'OVERRIDE_SET_LOOT'; value: number }
  | { t: 'OVERRIDE_ADJUST_LOOT'; delta: number }
  | { t: 'OVERRIDE_SET_STAT'; player: PlayerId; lane: Lane; value: number }
  | { t: 'OVERRIDE_ADJUST_STAT'; player: PlayerId; lane: Lane; delta: number }
  | { t: 'OVERRIDE_SET_POWERUP'; player: PlayerId; lane: Lane; held: boolean }
  /** untilRoom absent ⇒ clear the rest (un-rest the player). */
  | { t: 'OVERRIDE_SET_RESTING'; player: PlayerId; untilRoom?: number }
  | { t: 'OVERRIDE_REROLL_ROOM' }
  | { t: 'OVERRIDE_SKIP_ROOM' }
  | { t: 'OVERRIDE_SET_PHASE'; phase: RunPhase };

// ── RunEvent union ────────────────────────────────────────────────────────────
// E1 core events plus E2.5 GM-override events.
// The reducer's default: never assert enforces exhaustiveness — adding an
// unhandled event type is a compile error.

export type RunEvent =
  | { t: 'START_RUN'; crew: PlayerSetup[]; seed?: number }
  | { t: 'CHOOSE_OPTION'; optionId: string; committed: PlayerId[] }
  | { t: 'RESOLVE_MINIGAME'; outcome: Outcome }
  | { t: 'CHOOSE_SCENARIO'; choiceId: string; attemptedBy?: PlayerId }
  | { t: 'ASSIGN_GEAR'; gear: GearId; to: PlayerId }
  | { t: 'PUSH_ON' }
  | { t: 'CALL_GETAWAY' }
  | { t: 'RESOLVE_GETAWAY'; win?: boolean }
  | OverrideEvent;

// ── Harness-facing skill type ─────────────────────────────────────────────────
// Shared vocabulary for the balance harness (sim/). Carries no tunable numbers
// — those live in model-crew.ts (harness only, not a preset field).

export type Skill = 'bad' | 'avg' | 'good';
