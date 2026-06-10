import { describe, it, expect } from 'vitest';
import { getawayOdds, resolveGetawayOutcome, getawayBrief } from '@/engine/getaway';
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
    clamp: [0.04, 0.97] as [number, number],
    brief: {
      lowHeat:  { heat: 0,  targetCards: 5,  timerSeconds: 90 },
      highHeat: { heat: 20, targetCards: 12, timerSeconds: 45 },
    },
    ditchLootCost: 2000,
  },
  scoring: { winBaseMultiplier: 1.0, lowHeatStyleBonus: 0.5, bustMultiplier: 0.4 },
  scaling: {
    profiles: {
      '2': { getawayBonus: -0.04, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '3': { getawayBonus: -0.02, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '4': { getawayBonus: 0.0,   crewPerOption: [1, 2] as [number, number], exhaustion: 'light' as const },
      '5': { getawayBonus: 0.02,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '6': { getawayBonus: 0.035, crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '7': { getawayBonus: 0.05,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
    },
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
  quirks: {},
  banks: { categories: [], trivia: [] },
  roomTemplates: { obstacles: [], scenarios: [] },
};

// Helper: reproduce the Python getaway() formula for comparison.
function pyGetaway(H: number, n: number, crewskill: number): number {
  const playerBonus: Record<number, number> = {
    2: -0.04, 3: -0.02, 4: 0.0, 5: 0.02, 7: 0.05,
  };
  const frac = H / 20;
  let p = 1.0 - Math.pow(frac, 1.3);
  p += (crewskill - 0.65) * 0.5 + (playerBonus[n] ?? 0.0) * 0.8;
  return Math.max(0.04, Math.min(0.97, p));
}

describe('getawayOdds', () => {
  it('matches Python reference for avg skill, n=4, various heat levels', () => {
    for (const H of [0, 5, 10, 11, 14, 18, 20]) {
      const py = pyGetaway(H, 4, 0.65);
      const ts = getawayOdds(H, cfg, 4, 0.65);
      expect(ts).toBeCloseTo(py, 10);
    }
  });

  it('matches Python reference for bad skill (0.45), n=2', () => {
    for (const H of [0, 8, 14, 20]) {
      const py = pyGetaway(H, 2, 0.45);
      const ts = getawayOdds(H, cfg, 2, 0.45);
      expect(ts).toBeCloseTo(py, 10);
    }
  });

  it('matches Python reference for good skill (0.82), n=7', () => {
    for (const H of [0, 5, 11, 15, 20]) {
      const py = pyGetaway(H, 7, 0.82);
      const ts = getawayOdds(H, cfg, 7, 0.82);
      expect(ts).toBeCloseTo(py, 10);
    }
  });

  it('clamps to lower bound 0.04 at max heat with bad skill', () => {
    // Heat 20 with bad skill and small crew → may underflow; must be >= 0.04
    const p = getawayOdds(20, cfg, 2, 0.0);
    expect(p).toBe(cfg.getaway.clamp[0]);
  });

  it('clamps to upper bound 0.97 at zero heat with exceptional skill', () => {
    // Heat 0 with perfect skill and big crew → may overflow; must be <= 0.97
    const p = getawayOdds(0, cfg, 7, 1.0);
    expect(p).toBe(cfg.getaway.clamp[1]);
  });

  it('decreases monotonically as heat rises (avg skill, n=4)', () => {
    const heats = [0, 5, 10, 11, 15, 18, 20];
    const odds = heats.map(h => getawayOdds(h, cfg, 4, 0.65));
    for (let i = 1; i < odds.length; i++) {
      expect(odds[i]).toBeLessThanOrEqual(odds[i - 1]!);
    }
  });

  it('higher skill yields higher odds at the same heat', () => {
    const h = 10;
    const bad = getawayOdds(h, cfg, 4, 0.45);
    const avg = getawayOdds(h, cfg, 4, 0.65);
    const good = getawayOdds(h, cfg, 4, 0.82);
    expect(bad).toBeLessThan(avg);
    expect(avg).toBeLessThan(good);
  });

  it('larger headcount gives higher odds for n=5 vs n=2 at same heat/skill', () => {
    const h = 10;
    const small = getawayOdds(h, cfg, 2, 0.65);
    const large = getawayOdds(h, cfg, 5, 0.65);
    expect(large).toBeGreaterThan(small);
  });

  it('handles a missing headcount profile gracefully (no crash; no bonus applied)', () => {
    const noProfile = getawayOdds(10, cfg, 1, 0.65);
    const noBonus = (() => {
      const frac = 10 / 20;
      const p = 1.0 - Math.pow(frac, 1.3) + (0.65 - 0.65) * 0.5;
      return Math.max(0.04, Math.min(0.97, p));
    })();
    expect(noProfile).toBeCloseTo(noBonus, 10);
  });
});

describe('resolveGetawayOutcome', () => {
  const state = { heat: 10, crew: [{}] as never };

  it('returns true (win) when roll < odds', () => {
    // At heat 10, n=1 (no profile), skillPivot skill: p ≈ 1 - (0.5)^1.3 ≈ 0.588
    const odds = getawayOdds(10, cfg, 1, cfg.getaway.skillPivot);
    expect(resolveGetawayOutcome(state, cfg, { roll: odds - 0.01 })).toBe(true);
  });

  it('returns false (bust) when roll >= odds', () => {
    const odds = getawayOdds(10, cfg, 1, cfg.getaway.skillPivot);
    expect(resolveGetawayOutcome(state, cfg, { roll: odds })).toBe(false);
    expect(resolveGetawayOutcome(state, cfg, { roll: odds + 0.01 })).toBe(false);
  });

  it('uses crew.length as headcount', () => {
    const state4 = { heat: 10, crew: new Array(4) as never };
    const state7 = { heat: 10, crew: new Array(7) as never };
    const odds4 = getawayOdds(10, cfg, 4, cfg.getaway.skillPivot);
    const odds7 = getawayOdds(10, cfg, 7, cfg.getaway.skillPivot);
    // n=7 should have higher odds (getawayBonus 0.05 vs 0.00)
    expect(odds7).toBeGreaterThan(odds4);
    // Resolve against a roll between the two odds — wins for n=7, busts for n=4
    const midRoll = (odds4 + odds7) / 2;
    expect(resolveGetawayOutcome(state4, cfg, { roll: midRoll })).toBe(false);
    expect(resolveGetawayOutcome(state7, cfg, { roll: midRoll })).toBe(true);
  });

  it('defaults crewSkill to skillPivot when omitted', () => {
    // Should not differ from explicit skillPivot
    const withDefault = resolveGetawayOutcome(state, cfg, { roll: 0.1 });
    const withExplicit = resolveGetawayOutcome(state, cfg, {
      roll: 0.1,
      crewSkill: cfg.getaway.skillPivot,
    });
    expect(withDefault).toBe(withExplicit);
  });

  it('accepts an explicit crewSkill override', () => {
    // Very high skill at low heat → very high odds → roll 0.95 should win
    const highSkill = resolveGetawayOutcome(
      { heat: 0, crew: new Array(4) as never },
      cfg,
      { roll: 0.95, crewSkill: 0.82 },
    );
    // odds at heat 0, good skill, n=4 ≈ 0.97 (clamped) → roll 0.95 < 0.97 → win
    expect(highSkill).toBe(true);
  });
});

// ─── getawayBrief ─────────────────────────────────────────────────────────────

describe('getawayBrief', () => {
  // cfg.getaway.brief: lowHeat={heat:0,targetCards:5,timerSeconds:90}
  //                    highHeat={heat:20,targetCards:12,timerSeconds:45}

  it('returns integer targetCards and timerSeconds', () => {
    for (const heat of [0, 5, 11, 15, 20]) {
      const brief = getawayBrief(heat, cfg);
      expect(Number.isInteger(brief.targetCards)).toBe(true);
      expect(Number.isInteger(brief.timerSeconds)).toBe(true);
    }
  });

  it('targetCards is non-decreasing as heat rises (monotone)', () => {
    const heats = Array.from({ length: 21 }, (_, i) => i);
    const targets = heats.map(h => getawayBrief(h, cfg).targetCards);
    for (let i = 1; i < targets.length; i++) {
      expect(targets[i]).toBeGreaterThanOrEqual(targets[i - 1]!);
    }
  });

  it('timerSeconds is non-increasing as heat rises (monotone)', () => {
    const heats = Array.from({ length: 21 }, (_, i) => i);
    const timers = heats.map(h => getawayBrief(h, cfg).timerSeconds);
    for (let i = 1; i < timers.length; i++) {
      expect(timers[i]).toBeLessThanOrEqual(timers[i - 1]!);
    }
  });

  it('at heat 0 returns low-end anchor values', () => {
    const brief = getawayBrief(0, cfg);
    expect(brief.targetCards).toBe(cfg.getaway.brief.lowHeat.targetCards);
    expect(brief.timerSeconds).toBe(cfg.getaway.brief.lowHeat.timerSeconds);
  });

  it('at heat 20 (hMax) returns high-end anchor values', () => {
    const brief = getawayBrief(20, cfg);
    expect(brief.targetCards).toBe(cfg.getaway.brief.highHeat.targetCards);
    expect(brief.timerSeconds).toBe(cfg.getaway.brief.highHeat.timerSeconds);
  });

  it('at heat ~11 (escape signal) is between low and high anchors', () => {
    const brief = getawayBrief(11, cfg);
    expect(brief.targetCards).toBeGreaterThanOrEqual(cfg.getaway.brief.lowHeat.targetCards);
    expect(brief.targetCards).toBeLessThanOrEqual(cfg.getaway.brief.highHeat.targetCards);
    expect(brief.timerSeconds).toBeLessThanOrEqual(cfg.getaway.brief.lowHeat.timerSeconds);
    expect(brief.timerSeconds).toBeGreaterThanOrEqual(cfg.getaway.brief.highHeat.timerSeconds);
  });

  it('changing a tunable changes the output (reads from preset)', () => {
    const altCfg: EngineConfig = {
      ...cfg,
      getaway: {
        ...cfg.getaway,
        brief: {
          lowHeat:  { heat: 0,  targetCards: 3,  timerSeconds: 120 },
          highHeat: { heat: 20, targetCards: 15, timerSeconds: 30 },
        },
      },
    };
    // heat=15 ensures both targetCards and timerSeconds differ under the two anchor sets
    const base = getawayBrief(15, cfg);
    const alt  = getawayBrief(15, altCfg);
    expect(alt.targetCards).not.toBe(base.targetCards);
    expect(alt.timerSeconds).not.toBe(base.timerSeconds);
  });

  it('sane band at heat 0: small target, generous time (≤ 6 cards, ≥ 80 s)', () => {
    const brief = getawayBrief(0, cfg);
    expect(brief.targetCards).toBeLessThanOrEqual(6);
    expect(brief.timerSeconds).toBeGreaterThanOrEqual(80);
  });

  it('sane band at heat 11: mid-range target and time', () => {
    const brief = getawayBrief(11, cfg);
    expect(brief.targetCards).toBeGreaterThan(5);
    expect(brief.targetCards).toBeLessThan(12);
    expect(brief.timerSeconds).toBeLessThan(90);
    expect(brief.timerSeconds).toBeGreaterThan(45);
  });

  it('sane band at heat 20: large target, short time (≥ 10 cards, ≤ 55 s)', () => {
    const brief = getawayBrief(20, cfg);
    expect(brief.targetCards).toBeGreaterThanOrEqual(10);
    expect(brief.timerSeconds).toBeLessThanOrEqual(55);
  });
});
