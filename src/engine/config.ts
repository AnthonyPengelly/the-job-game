// The frozen, parsed shape the pure engine reducer reads from the active preset.
// Defined here so the engine never imports from the content or platform layers.

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
    /** Keyed by headcount string ("2"–"7"). Only the getawayBonus term is needed by the engine. */
    profiles: Record<string, { getawayBonus: number }>;
    /** Hard per-game commit floor. Keyed by gameId string. */
    minCommit: Record<string, number>;
  };
  generation: {
    /** Probability [0,1] of drawing an obstacle room vs a scenario room. */
    obstacleRatio: number;
  };
  roomTemplates: RoomTemplatesConfig;
}
