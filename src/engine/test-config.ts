// Shared minimal EngineConfig used across engine unit tests.
// Three obstacles (alpha/bravo/charlie) and two scenarios give the seeded
// room generator enough content to exercise without repeating.
import type { EngineConfig } from './config';

export const testCfg: EngineConfig = {
  heat: { hMax: 20, runAtFraction: 0.55 },
  escalation: { onsetRoom: 5, rampPerObstacle: 0.2 },
  obstacleHeat: { safe: 1, greedy: 2, greedyBelowFraction: 0.5 },
  outcomeHeat: { clean: 0, complication: 1, botched: 2 },
  outcomeLoot: { complication: 1, botched: 0 },
  scenarioSwing: { small: 2, big: 4 },
  getaway: { exponent: 1.3, skillTerm: 0.5, skillPivot: 0.65, headcountTerm: 0.8, clamp: [0.04, 0.97] },
  scoring: { winBaseMultiplier: 1.0, lowHeatStyleBonus: 0.5, bustMultiplier: 0.4 },
  scaling: {
    profiles: {
      '2': { getawayBonus: -0.03, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '3': { getawayBonus: -0.02, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '4': { getawayBonus: 0.0,   crewPerOption: [1, 2] as [number, number], exhaustion: 'light' as const },
      '5': { getawayBonus: 0.02,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '6': { getawayBonus: 0.035, crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '7': { getawayBonus: 0.06,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
    },
    exhaustionRest: { full: 1, light: 1, tired: 0 },
    minCommit: { alpha: 1, bravo: 1, charlie: 1 },
    variant: {},
    excludedFromSolo: [],
    soloEligibleMinPool: 8,
    dialCurve: { _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 } },
  },
  generation: { obstacleRatio: 0.7 },
  gear: {},
  roomTemplates: {
    obstacles: [
      {
        id: 'obs-alpha',
        gameId: 'alpha',
        lane: 'tech',
        options: [
          { id: 'alpha-safe',   greedy: false, heatCost: 1, reward: 1 },
          { id: 'alpha-greedy', greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
      {
        id: 'obs-bravo',
        gameId: 'bravo',
        lane: 'physical',
        options: [
          { id: 'bravo-safe',   greedy: false, heatCost: 1, reward: 1 },
          { id: 'bravo-greedy', greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
      {
        id: 'obs-charlie',
        gameId: 'charlie',
        lane: 'stealth',
        options: [
          { id: 'charlie-safe',   greedy: false, heatCost: 1, reward: 1 },
          { id: 'charlie-greedy', greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
    ],
    scenarios: [
      {
        id: 'scen-1',
        choices: [
          { id: 's1-a', label: 'A', heatDelta: -1, lootDelta: 0 },
          { id: 's1-b', label: 'B', heatDelta:  0, lootDelta: 1 },
        ],
      },
      {
        id: 'scen-2',
        choices: [
          { id: 's2-a', label: 'A', heatDelta: 2, lootDelta: 0 },
          { id: 's2-b', label: 'B', heatDelta: -1, lootDelta: 1 },
        ],
      },
    ],
  },
};
