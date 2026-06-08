import { describe, it, expect } from 'vitest';
import {
  obstacleDrip,
  greedyAvailable,
  greedySurcharge,
  outcomeHeat,
  applyScenarioSwing,
  escapeSignal,
  forcedGetaway,
} from '@/engine/heat';
import type { EngineConfig } from '@/engine/config';

// Mirror of the default preset values — kept inline so tests have no platform dependency.
const cfg: EngineConfig = {
  heat: { hMax: 20, runAtFraction: 0.55 },
  escalation: { onsetRoom: 5, rampPerObstacle: 0.2 },
  obstacleHeat: { safe: 1, greedy: 2, greedyBelowFraction: 0.5 },
  outcomeHeat: { clean: 0, complication: 1, botched: 2 },
  outcomeLoot: { complication: 1, botched: 0 },
  scenarioSwing: { small: 2, big: 4 },
  getaway: {
    exponent: 1.3, skillTerm: 0.5, skillPivot: 0.65, headcountTerm: 0.8, clamp: [0.04, 0.97] as [number, number],
    brief: {
      lowHeat:  { heat: 0,  targetCards: 5,  timerSeconds: 90 },
      highHeat: { heat: 20, targetCards: 12, timerSeconds: 45 },
    },
    ditchHeatCost: 2,
    buySecondsBonus: 20,
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
    heatDial: { perHeat: 0, perRoom: 0 },
  },
  generation: { obstacleRatio: 0.6 },
  scenario: { dcClamp: [1, 20] as [number, number], easeDialSteps: 1, critFumble: false, heatDC: { perHeat: 0, perRoom: 0 } },
  rewardScale: { perHeat: 0, perRoom: 0 },
  gearSellValue: { base: 1000, perRoom: 500 },
  gear: {},
  banks: { categories: [], trivia: [] },
  roomTemplates: { obstacles: [], scenarios: [] },
};

describe('obstacleDrip', () => {
  it('room 0: safe + floor(0 * 0.2) = 1', () => {
    expect(obstacleDrip(0, cfg)).toBe(1);
  });

  it('room 5: safe + floor(5 * 0.2) = 1 + 1 = 2 (acceptance criterion)', () => {
    expect(obstacleDrip(5, cfg)).toBe(2);
  });

  it('room 10: safe + floor(10 * 0.2) = 1 + 2 = 3', () => {
    expect(obstacleDrip(10, cfg)).toBe(3);
  });

  it('room 4: safe + floor(4 * 0.2) = 1 + 0 = 1 (ramp not yet kicking in)', () => {
    expect(obstacleDrip(4, cfg)).toBe(1);
  });

  it('matches Python reference: base_ob + int(room * ramp_step)', () => {
    for (const room of [0, 1, 3, 5, 7, 10, 15, 20]) {
      const expected = 1 + Math.floor(room * 0.2);
      expect(obstacleDrip(room, cfg)).toBe(expected);
    }
  });
});

describe('greedyAvailable', () => {
  it('returns true when heat is below greedyBelowFraction * hMax (= 10)', () => {
    expect(greedyAvailable(0, cfg)).toBe(true);
    expect(greedyAvailable(9, cfg)).toBe(true);
  });

  it('returns false at the threshold (10 is NOT < 10)', () => {
    expect(greedyAvailable(10, cfg)).toBe(false);
  });

  it('returns false above the threshold', () => {
    expect(greedyAvailable(11, cfg)).toBe(false);
    expect(greedyAvailable(20, cfg)).toBe(false);
  });
});

describe('greedySurcharge', () => {
  it('returns greedy − safe = +1 (the on-top surcharge; Python greedy_x)', () => {
    expect(greedySurcharge(cfg)).toBe(1);
  });

  it('total greedy obstacle = obstacleDrip(room) + greedySurcharge() = greedy + ramp', () => {
    // room 5: obstacleDrip = 1+1=2, greedySurcharge = 1, total = 3 = greedy(2)+ramp(1)
    expect(obstacleDrip(5, cfg) + greedySurcharge(cfg)).toBe(3);
    // room 0: obstacleDrip = 1, greedySurcharge = 1, total = 2 = greedy(2)+ramp(0)
    expect(obstacleDrip(0, cfg) + greedySurcharge(cfg)).toBe(2);
  });
});

describe('outcomeHeat', () => {
  it('clean outcome adds 0 heat', () => {
    expect(outcomeHeat('clean', cfg)).toBe(0);
  });

  it('complication outcome adds 1 heat', () => {
    expect(outcomeHeat('complication', cfg)).toBe(1);
  });

  it('botched outcome adds 2 heat (structural assertion J)', () => {
    expect(outcomeHeat('botched', cfg)).toBe(2);
  });
});

describe('applyScenarioSwing', () => {
  it('applies a positive delta (heat increase)', () => {
    expect(applyScenarioSwing(5, 2)).toBe(7);
  });

  it('applies a negative delta (cool-down)', () => {
    expect(applyScenarioSwing(5, -2)).toBe(3);
  });

  it('clamps at 0 — heat cannot go negative', () => {
    expect(applyScenarioSwing(1, -5)).toBe(0);
    expect(applyScenarioSwing(0, -4)).toBe(0);
  });

  it('works with cfg.scenarioSwing.small as the small swing magnitude', () => {
    expect(applyScenarioSwing(8, cfg.scenarioSwing.small)).toBe(10);
    expect(applyScenarioSwing(8, -cfg.scenarioSwing.small)).toBe(6);
  });

  it('works with cfg.scenarioSwing.big as the big swing magnitude', () => {
    expect(applyScenarioSwing(8, cfg.scenarioSwing.big)).toBe(12);
    expect(applyScenarioSwing(3, -cfg.scenarioSwing.big)).toBe(0); // 3 - 4 = -1 → clamped to 0
  });
});

describe('escapeSignal', () => {
  it('returns false at room 1 regardless of heat (acceptance criterion)', () => {
    expect(escapeSignal({ roomIndex: 1, heat: 15 }, cfg)).toBe(false);
    expect(escapeSignal({ roomIndex: 1, heat: 20 }, cfg)).toBe(false);
  });

  it('returns false at room 0 regardless of heat', () => {
    expect(escapeSignal({ roomIndex: 0, heat: 20 }, cfg)).toBe(false);
  });

  it('returns false when heat is below runAtFraction * hMax = 11', () => {
    expect(escapeSignal({ roomIndex: 2, heat: 10 }, cfg)).toBe(false);
    expect(escapeSignal({ roomIndex: 5, heat: 10 }, cfg)).toBe(false);
  });

  it('returns true at Heat 11 / room 2 (acceptance criterion: runAtFraction * hMax = 0.55 * 20 = 11)', () => {
    expect(escapeSignal({ roomIndex: 2, heat: 11 }, cfg)).toBe(true);
  });

  it('returns true at room >= 2 with heat >= runAt threshold', () => {
    expect(escapeSignal({ roomIndex: 3, heat: 11 }, cfg)).toBe(true);
    expect(escapeSignal({ roomIndex: 10, heat: 15 }, cfg)).toBe(true);
  });

  it('boundary: heat exactly at threshold (11) with room exactly 2 fires the signal', () => {
    expect(escapeSignal({ roomIndex: 2, heat: 11 }, cfg)).toBe(true);
  });
});

describe('forcedGetaway', () => {
  it('returns false below hMax', () => {
    expect(forcedGetaway(19, cfg)).toBe(false);
    expect(forcedGetaway(0, cfg)).toBe(false);
  });

  it('returns true at hMax = 20 (acceptance criterion)', () => {
    expect(forcedGetaway(20, cfg)).toBe(true);
  });

  it('returns true above hMax', () => {
    expect(forcedGetaway(21, cfg)).toBe(true);
  });

  it('boundary: 19 is false, 20 is true', () => {
    expect(forcedGetaway(19, cfg)).toBe(false);
    expect(forcedGetaway(20, cfg)).toBe(true);
  });
});
