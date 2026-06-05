// The frozen, parsed shape the pure engine reducer reads from the active preset.
// Defined here so the engine never imports from the content or platform layers.
import type { Lane } from './types';

// ── Trivia bank type (mirrored from content schema; defined here to avoid upward imports) ──

export interface TriviaItemConfig {
  question: string;
  answer: string;
  tier: 'easy' | 'medium' | 'hard';
  options?: string[];
}

// ── Gear catalog types ────────────────────────────────────────────────────────

export type GearDef =
  | { id: string; kind: 'statBoost'; lane: Lane; magnitude: number }
  | { id: string; kind: 'powerUp'; lane: Lane };

// ── Room template config types ────────────────────────────────────────────────

export interface ObstacleOptionConfig {
  id: string;
  greedy: boolean;
  /** Nominal heat cost (display/reference). Actual heat applied via obstacleDrip(). */
  heatCost: number;
  /** Loot reward on a clean outcome (2 if greedy, 1 if safe by convention). */
  reward: number;
}

export interface ObstacleTemplateConfig {
  id: string;
  /** Must match a key in scaling.minCommit; runtime-cast to GameId where needed. */
  gameId: string;
  /** Lane tag (tech|physical|charm|stealth) for clue display. */
  lane: string;
  /** Exactly [safe option, greedy option]. */
  options: [ObstacleOptionConfig, ObstacleOptionConfig];
}

export interface ScenarioChoiceConfig {
  id: string;
  /** Revealed to players; effects are hidden until after the commit. */
  label: string;
  /** Signed heat delta — negative cools, positive heats. Clamp applied by applyScenarioSwing. */
  heatDelta: number;
  /** Loot awarded (0, 1, 2). */
  lootDelta: number;
}

export interface ScenarioTemplateConfig {
  id: string;
  choices: [ScenarioChoiceConfig, ScenarioChoiceConfig];
}

export interface RoomTemplatesConfig {
  obstacles: ObstacleTemplateConfig[];
  scenarios: ScenarioTemplateConfig[];
}

// ── Full engine config ────────────────────────────────────────────────────────

export interface EngineConfig {
  heat: {
    hMax: number;
    runAtFraction: number;
  };
  escalation: {
    onsetRoom: number;
    rampPerObstacle: number;
  };
  obstacleHeat: {
    safe: number;
    greedy: number;
    greedyBelowFraction: number;
  };
  outcomeHeat: {
    clean: number;
    complication: number;
    botched: number;
  };
  outcomeLoot: {
    complication: number;
    botched: number;
  };
  scenarioSwing: {
    small: number;
    big: number;
  };
  getaway: {
    exponent: number;
    skillTerm: number;
    skillPivot: number;
    headcountTerm: number;
    clamp: [number, number];
  };
  scoring: {
    winBaseMultiplier: number;
    lowHeatStyleBonus: number;
    bustMultiplier: number;
  };
  scaling: {
    /** Keyed by headcount string ("2"–"7"). Full per-headcount profile. */
    profiles: Record<string, {
      getawayBonus: number;
      crewPerOption: [number, number];
      exhaustion: 'full' | 'light' | 'tired';
    }>;
    /** Rooms benched per exhaustion class after committing to an obstacle. tired=0 means no bench. */
    exhaustionRest: Record<'full' | 'light' | 'tired', number>;
    /** Hard per-game commit floor. Keyed by gameId string. */
    minCommit: Record<string, number>;
    /** Replacement game variant per game, keyed by gameId. */
    variant: Record<string, { soloVariantId?: string | undefined; variantId?: string | undefined; appliesAt: number[] }>;
    /** Game ids that may never be offered as a solo (commit-1) obstacle. */
    excludedFromSolo: string[];
    /** Obstacle pool must be at least this size before a commit-1 slot is legal. */
    soloEligibleMinPool: number;
    /** Difficulty dial curve per game (or "_default"). */
    dialCurve: Record<string, { base: number; perLanePoint: number; tightenPerExtraCrew: number }>;
  };
  generation: {
    /** Probability [0,1] of drawing an obstacle room vs a scenario room. */
    obstacleRatio: number;
  };
  roomTemplates: RoomTemplatesConfig;
  /** Gear catalog keyed by gear id. Loaded from content/gear.json. */
  gear: Record<string, GearDef>;
  /** Content banks loaded from the active preset. */
  banks: {
    categories: string[];
    trivia: TriviaItemConfig[];
  };
}
