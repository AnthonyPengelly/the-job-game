// The frozen, parsed shape the pure engine reducer reads from the active preset.
// Defined here so the engine never imports from the content or platform layers.

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
}
