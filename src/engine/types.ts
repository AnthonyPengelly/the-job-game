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

// ── Scenario content model (E7.1) ─────────────────────────────────────────────
// Defined in types.ts so engine code and content schemas share the same shape.

/** Describes a gear grant in a scenario outcome. */
export interface GearGrantDescriptor {
  kind: 'statBoost' | 'powerUp' | 'bigScore';
  /** Single-lane grant. Exactly one of lane / lanes must be present. */
  lane?: Lane;
  /** Multi-lane choice (GM picks which lane applies). */
  lanes?: Lane[];
}

/**
 * A delayed payoff carried forward until roomsLeft ticks to 0 (e.g. briefcase).
 * Self-referential via ScenarioEffect; TypeScript resolves the cycle via interface.
 */
export interface DelayedPayoff {
  kind: string;
  roomsLeft: number;
  payoff: ScenarioEffect;
  /** Applied on each room tick while still carried (e.g. briefcase per-room Heat ↑). */
  perRoomEffect?: ScenarioEffect;
}

/** Structured outcome of a scenario choice, covering all five currencies. */
export interface ScenarioEffect {
  heatDelta: number;
  lootDelta: number;
  /** If present, resolves to a GearId and pushes to earnedGear. */
  gear?: GearGrantDescriptor;
  /** When true, spawns an easeNextObstacle carried effect. */
  info?: boolean;
  /** A timed payoff (e.g. briefcase → Loot++ in N rooms). */
  delayed?: DelayedPayoff;
}

/** A roll-based outcome spec for a scenario choice. */
export interface ScenarioRollSpec {
  lane: Lane;
  baseDifficulty: number;
  success: ScenarioEffect;
  failure: ScenarioEffect;
}

/** A single scenario choice: either a flat effect or a lane-weighted roll. */
export type ScenarioChoiceDef =
  | { id: string; label: string; effect: ScenarioEffect }
  | { id: string; label: string; roll: ScenarioRollSpec };

/** The canonical scenario content model resolved into the engine config. */
export interface ScenarioDef {
  id: string;
  setup: string;
  choices: [ScenarioChoiceDef, ScenarioChoiceDef];
}

/**
 * Captured state for a roll choice mid-resolution (after CHOOSE_SCENARIO, before
 * RESOLVE_SCENARIO_ROLL). Stored on ScenarioRoom so RESOLVE_SCENARIO_ROLL can
 * read the revealed values without re-computing.
 */
export interface PendingRoll {
  choiceId: string;
  attemptedBy: PlayerId;
  lane: Lane;
  laneRating: number;
  baseDifficulty: number;
  dc: number;
}

/**
 * The resolved roll result stored on ScenarioRoom after RESOLVE_SCENARIO_ROLL.
 * Stays on the room until ACK_SCENARIO_ROLL, letting the UI reveal the result
 * dramatically before transitioning to the offer phase.
 *
 * total = roll + laneRating (display convenience only — NOT the pass/fail comparison).
 * The honest verdict comparison is roll >= dc. dc already folds in the lane bonus
 * AND a heat/depth term (see computeDC in scenario.ts), so total >= baseDifficulty
 * diverges from the actual result once heat/depth are nonzero.
 * The engine already applied the loot/heat/gear grant when storing this — these
 * deltas are carried here for display only.
 */
export interface ResolvedRoll {
  roll: number;
  total: number;
  dc: number;
  lane: Lane;
  laneRating: number;
  baseDifficulty: number;
  result: Outcome;
  lootDelta: number;
  heatDelta: number;
  gear?: GearGrantDescriptor;
}

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
  /** Gear grant awarded on a clean outcome. Mirrors the reward field: fires only on clean. */
  gear?: GearGrantDescriptor;
  /**
   * Exact crew size this option demands, drawn at generation by the seeded RNG
   * within the scaling-aware [minCrew, maxCrew] range (playtest wave 2: the
   * room dictates the headcount — never a player choice). Set by generateRoom
   * when crew ≥ 2 and the game is not fullTeam.
   */
  commitCount?: number;
  /** True for games where the whole crew plays and no exhaustion rotation applies afterward. */
  fullTeam?: boolean;
}

export interface ObstacleRoom {
  kind: 'obstacle';
  templateId: string;
  options: ObstacleOption[];
  committedOptionId?: string;
  committedBy?: PlayerId[];
  /** Dial steps to subtract from mini-game difficulty; set by an active easeNextObstacle carried effect. */
  easeDialSteps?: number;
}

export interface ScenarioChoice {
  id: string;
  label: string;
  /** Whether this choice requires a d20 roll (opaque pre-commit; revealed in stage two). */
  isRoll: boolean;
}

export interface ScenarioRoom {
  kind: 'scenario';
  templateId: string;
  /** The scenario flavour text read aloud by the GM. */
  setup: string;
  choices: [ScenarioChoice, ScenarioChoice];
  /** Set after CHOOSE_SCENARIO for a roll choice; cleared by RESOLVE_SCENARIO_ROLL. */
  pendingRoll?: PendingRoll;
  /**
   * Set by RESOLVE_SCENARIO_ROLL: the applied roll result for UI reveal.
   * Cleared and room set to null by ACK_SCENARIO_ROLL (which advances to offer).
   */
  resolvedRoll?: ResolvedRoll;
}

export type CurrentRoom = ObstacleRoom | ScenarioRoom;

// ── Carried effects ───────────────────────────────────────────────────────────

/** A timed effect that ticks down each room (e.g. briefcase countdown). */
export interface CarriedEffect {
  id: string;
  kind: string;
  roomsLeft: number;
  /** Applied via applyScenarioEffect when roomsLeft reaches 0 (e.g. briefcase Loot++). */
  payoff?: ScenarioEffect;
  /** Applied each room while still carried (before expiry). */
  perRoomEffect?: ScenarioEffect;
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
      /** Present when this was a roll choice. */
      roll?: number;
      dc?: number;
      success?: boolean;
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
  /** The GM-entered crew name (e.g. "The Magpies"). Empty string when not set. */
  crewName: string;
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
  /**
   * Gear earned from scenario outcomes, waiting for the GM to ASSIGN_GEAR.
   * A GearId means the gear is fully resolved (single-lane grant).
   * A GearGrantDescriptor means the crew still needs to choose which lane applies
   * (multi-lane grant) — the GM picks a lane and dispatches ASSIGN_GEAR with the
   * resulting GearId.
   */
  earnedGear: Array<GearId | GearGrantDescriptor>;
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
  | { t: 'START_RUN'; crew: PlayerSetup[]; seed?: number; crewName?: string }
  | { t: 'CHOOSE_OPTION'; optionId: string; committed: PlayerId[] }
  | { t: 'RESOLVE_MINIGAME'; outcome: Outcome }
  | { t: 'CHOOSE_SCENARIO'; choiceId: string; attemptedBy?: PlayerId }
  | { t: 'RESOLVE_SCENARIO_ROLL'; externalRoll?: number }
  | { t: 'ACK_SCENARIO_ROLL' }
  | { t: 'ASSIGN_GEAR'; gear: GearId; to: PlayerId; earnedGearIndex?: number }
  | { t: 'SELL_GEAR'; index: number }
  | { t: 'PUSH_ON' }
  | { t: 'CALL_GETAWAY' }
  | { t: 'GETAWAY_DITCH' }
  | { t: 'RESOLVE_GETAWAY'; win?: boolean }
  | OverrideEvent;

// ── Harness-facing skill type ─────────────────────────────────────────────────
// Shared vocabulary for the balance harness (sim/). Carries no tunable numbers
// — those live in src/console/tuning/montecarlo.ts (shared core, harness + panel).

export type Skill = 'bad' | 'avg' | 'good';
