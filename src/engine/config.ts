// The frozen, parsed shape the pure engine reducer reads from the active preset.
// Defined here so the engine never imports from the content or platform layers.
import type { Lane, ScenarioDef } from './types';

// ── Quirk types ────────────────────────────────────────────────────────────────

export interface QuirkBoost {
  lane: Lane;
  magnitude: number;
}

export interface QuirkDef {
  id: string;
  name: string;
  boosts: QuirkBoost[];
}

// ── Trivia bank type (mirrored from content schema; defined here to avoid upward imports) ──

export interface TriviaItemConfig {
  question: string;
  answer: string;
  tier: 'easy' | 'medium' | 'hard';
  options?: string[];
}

// ── Gear catalog types ────────────────────────────────────────────────────────

export type GearDef =
  | { id: string; kind: 'statBoost'; lane: Lane; magnitude: number; name: string; blurb: string }
  | { id: string; kind: 'powerUp'; lane: Lane; name: string; blurb: string };

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
  /** True for games where the whole crew plays and no exhaustion rotation applies afterward. */
  fullTeam?: boolean;
}

export interface RoomTemplatesConfig {
  obstacles: ObstacleTemplateConfig[];
  /** Scenario pool drawn by generation. Uses the full ScenarioDef from types.ts. */
  scenarios: ScenarioDef[];
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
    /** Floor payout for a complication (raw loot units). */
    complication: number;
    /** Fraction of the option reward paid on a complication (the larger of floor/fraction wins). */
    complicationFraction: number;
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
    /** Difficulty anchors for Heat→(targetCards, timerSeconds) mapping. */
    brief: {
      lowHeat: { heat: number; targetCards: number; timerSeconds: number };
      highHeat: { heat: number; targetCards: number; timerSeconds: number };
    };
    /** Loot forfeited when the crew ditches a card during the Getaway. Clamped at 0. */
    ditchLootCost: number;
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
    /** Heat/depth contribution to the obstacle dial (no-op at defaults 0/0). */
    heatDial: { perHeat: number; perRoom: number };
  };
  generation: {
    /** Probability [0,1] of drawing an obstacle room vs a scenario room. */
    obstacleRatio: number;
  };
  scenario: {
    /** DC is clamped to this range. Default [1, 20]. */
    dcClamp: [number, number];
    /** Dial steps subtracted from the next obstacle when an info effect fires. */
    easeDialSteps: number;
    /** Whether nat-20 always succeeds and nat-1 always fails, overriding the DC. */
    critFumble: boolean;
    /** Heat/depth bonus added to the raw DC before clamping (no-op at defaults 0/0). */
    heatDC: { perHeat: number; perRoom: number };
  };
  roomTemplates: RoomTemplatesConfig;
  /** Preset curve for scaling generated obstacle rewards with Heat and room depth (no-op at defaults 0/0). */
  rewardScale: {
    perHeat: number;
    perRoom: number;
  };
  /**
   * Visible gear sell rule: perBonusPoint × bonus points + perRoom × roomIndex.
   * Bonus points = statBoost magnitude (1 or 2); a power-up is worth powerUpPoints.
   * Selling deeper in the heist still pays more via the perRoom term.
   */
  gearSellValue: {
    perBonusPoint: number;
    powerUpPoints: number;
    perRoom: number;
  };
  /**
   * Obstacle gear-drop economy (wave 3: EVERY door drops gear).
   *   bigScoreChance — chance a statBoost drop upgrades to the +2 tier
   *   powerUpChance  — chance a drop is a power-up instead of a stat boost
   *   extraDropChancePerPlayer — per crew member above 4, chance of +1 drop
   *     in the room (bigger tables get more cards to share out)
   *   maxDrops — hard cap on drops per option
   */
  gearDrops: {
    bigScoreChance: number;
    powerUpChance: number;
    extraDropChancePerPlayer: number;
    maxDrops: number;
  };
  /** Gear catalog keyed by gear id. Loaded from content/gear.json. */
  gear: Record<string, GearDef>;
  /** Content banks loaded from the active preset. */
  banks: {
    categories: string[];
    trivia: TriviaItemConfig[];
  };
  /** Quirk table keyed by quirk id. Loaded from content/quirks.json. */
  quirks: Record<string, QuirkDef>;
}
