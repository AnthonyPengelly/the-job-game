import { describe, it, expect } from 'vitest';
import { scoreRun } from '@/engine/scoring';
import type { EngineConfig } from '@/engine/config';

// Mirror of the default preset — inline so tests have no platform dependency.
const cfg: EngineConfig = {
  heat: { hMax: 20, runAtFraction: 0.55 },
  escalation: { onsetRoom: 5, rampPerObstacle: 0.2 },
  obstacleHeat: { safe: 1, greedy: 2, greedyBelowFraction: 0.5 },
  outcomeHeat: { clean: 0, complication: 1, botched: 2 },
  outcomeLoot: { complication: 1, botched: 0 },
  scenarioSwing: { small: 2, big: 4 },
  getaway: {
    exponent: 1.3,
    skillTerm: 0.5,
    skillPivot: 0.65,
    headcountTerm: 0.8,
    clamp: [0.04, 0.97],
  },
  scoring: { winBaseMultiplier: 1.0, lowHeatStyleBonus: 0.5, bustMultiplier: 0.4 },
  scaling: {
    profiles: {},
    exhaustionRest: { full: 1, light: 1, tired: 0 },
    minCommit: {},
    variant: {},
    excludedFromSolo: [],
    soloEligibleMinPool: 8,
    dialCurve: { _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 } },
  },
  generation: { obstacleRatio: 0.6 },
  gear: {},
  roomTemplates: { obstacles: [], scenarios: [] },
};

// Python reference: win → loot*(1.0+0.5*(1-H/HMAX)); bust → loot*0.4
function pyScore(loot: number, H: number, win: boolean): number {
  return win ? loot * (1.0 + 0.5 * (1 - H / 20)) : loot * 0.4;
}

describe('scoreRun', () => {
  it('win at Heat 0: full base multiplier + full style bonus = loot * 1.5', () => {
    expect(scoreRun(10, 0, true, cfg)).toBeCloseTo(10 * 1.5, 10);
    expect(scoreRun(10, 0, true, cfg)).toBeCloseTo(pyScore(10, 0, true), 10);
  });

  it('win at hMax (20): base multiplier only, style bonus = 0 → loot * 1.0', () => {
    expect(scoreRun(10, 20, true, cfg)).toBeCloseTo(10 * 1.0, 10);
    expect(scoreRun(10, 20, true, cfg)).toBeCloseTo(pyScore(10, 20, true), 10);
  });

  it('win at Heat 10: style bonus is half its max → loot * 1.25', () => {
    expect(scoreRun(10, 10, true, cfg)).toBeCloseTo(10 * 1.25, 10);
    expect(scoreRun(10, 10, true, cfg)).toBeCloseTo(pyScore(10, 10, true), 10);
  });

  it('bust at any heat: loot * bustMultiplier (0.4)', () => {
    for (const H of [0, 5, 11, 20]) {
      expect(scoreRun(10, H, false, cfg)).toBeCloseTo(10 * 0.4, 10);
      expect(scoreRun(10, H, false, cfg)).toBeCloseTo(pyScore(10, H, false), 10);
    }
  });

  it('matches Python formula across a table of (loot, heat, win) samples', () => {
    const cases: Array<[number, number, boolean]> = [
      [0, 0, true],
      [0, 10, false],
      [5, 11, true],
      [8, 0, true],
      [8, 20, true],
      [12, 15, false],
      [20, 10, true],
    ];
    for (const [loot, H, win] of cases) {
      expect(scoreRun(loot, H, win, cfg)).toBeCloseTo(pyScore(loot, H, win), 10);
    }
  });

  it('win score is always >= bust score for the same loot and heat', () => {
    for (const H of [0, 5, 10, 15, 20]) {
      expect(scoreRun(10, H, true, cfg)).toBeGreaterThanOrEqual(scoreRun(10, H, false, cfg));
    }
  });

  it('style bonus is generous at Heat 0 (win score approaches max) and zero at hMax', () => {
    const winAt0 = scoreRun(1, 0, true, cfg);
    const winAtMax = scoreRun(1, cfg.heat.hMax, true, cfg);
    expect(winAt0).toBeGreaterThan(winAtMax);
    // At hMax: style bonus term = lowHeatStyleBonus * (1 - hMax/hMax) = 0
    expect(winAtMax).toBeCloseTo(cfg.scoring.winBaseMultiplier, 10);
  });

  it('loot = 0 always yields score 0 regardless of win/bust', () => {
    expect(scoreRun(0, 10, true, cfg)).toBe(0);
    expect(scoreRun(0, 10, false, cfg)).toBe(0);
  });
});
