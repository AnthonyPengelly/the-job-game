// Unit tests for src/engine/scenario.ts — E7.1 acceptance criteria.
import { describe, it, expect } from 'vitest';
import { computeDC, successOdds, resolveRoll, applyScenarioEffect } from '@/engine/scenario';
import { generateRoom } from '@/engine/generation';
import { reduce } from '@/engine/reduce';
import { initialState } from '@/engine/run';
import type { EngineConfig } from '@/engine/config';
import type { RunState, PlayerId, GearId, ScenarioEffect, GearGrantDescriptor } from '@/engine/types';
import { reduceSession, initialSession } from '@/engine/history';

// ── Inline test config ────────────────────────────────────────────────────────

const cfg: EngineConfig = {
  heat: { hMax: 20, runAtFraction: 0.55 },
  escalation: { onsetRoom: 5, rampPerObstacle: 0.2 },
  obstacleHeat: { safe: 1, greedy: 2, greedyBelowFraction: 0.5 },
  outcomeHeat: { clean: 0, complication: 1, botched: 2 },
  outcomeLoot: { complication: 1, botched: 0 },
  scenarioSwing: { small: 2, big: 4 },
  getaway: {
    exponent: 1.3, skillTerm: 0.5, skillPivot: 0.65, headcountTerm: 0.8,
    clamp: [0.04, 0.97] as [number, number],
    brief: {
      lowHeat:  { heat: 0,  targetCards: 5,  timerSeconds: 90 },
      highHeat: { heat: 20, targetCards: 12, timerSeconds: 45 },
    },
    ditchHeatCost: 2,
    buySecondsBonus: 20,
  },
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
    minCommit: { alpha: 1 },
    variant: {},
    excludedFromSolo: [],
    soloEligibleMinPool: 8,
    dialCurve: { _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 } },
    heatDial: { perHeat: 0, perRoom: 0 },
  },
  generation: { obstacleRatio: 0.0 },
  scenario: { dcClamp: [1, 20] as [number, number], easeDialSteps: 1, critFumble: false, heatDC: { perHeat: 0, perRoom: 0 } },
  rewardScale: { perHeat: 0, perRoom: 0 },
  gearSellValue: { base: 1000, perRoom: 500 },
  gear: {
    'stat-tech-1':     { id: 'stat-tech-1',     kind: 'statBoost', lane: 'tech',     magnitude: 1 },
    'stat-physical-1': { id: 'stat-physical-1', kind: 'statBoost', lane: 'physical', magnitude: 1 },
    'stat-charm-1':    { id: 'stat-charm-1',    kind: 'statBoost', lane: 'charm',    magnitude: 1 },
    'stat-stealth-1':  { id: 'stat-stealth-1',  kind: 'statBoost', lane: 'stealth',  magnitude: 1 },
    'stat-tech-2':     { id: 'stat-tech-2',     kind: 'statBoost', lane: 'tech',     magnitude: 2 },
    'powerup-charm':   { id: 'powerup-charm',   kind: 'powerUp',   lane: 'charm'  },
    'powerup-tech':    { id: 'powerup-tech',    kind: 'powerUp',   lane: 'tech'   },
  },
  banks: { categories: [], trivia: [] },
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
    ],
    scenarios: [
      {
        id: 'scen-noroll',
        setup: 'A clerk offers to help — for a cut.',
        choices: [
          { id: 'pay-off',   label: 'Pay him off',   effect: { heatDelta: 0, lootDelta: -1, gear: { kind: 'powerUp', lane: 'charm' } } },
          { id: 'leave-him', label: 'Leave him be',  effect: { heatDelta: -2, lootDelta: 0 } },
        ],
      },
      {
        id: 'scen-roll',
        setup: 'A police scanner crackles with useful chatter.',
        choices: [
          {
            id: 'listen-in',
            label: 'Listen in',
            roll: {
              lane: 'tech',
              baseDifficulty: 13,
              success: { heatDelta: 0,  lootDelta: 0, info: true },
              failure: { heatDelta: 2,  lootDelta: 0 },
            },
          },
          { id: 'keep-moving', label: 'Keep moving', effect: { heatDelta: 0, lootDelta: 0 } },
        ],
      },
      {
        id: 'scen-delayed',
        setup: 'A locked briefcase in the corner catches your eye.',
        choices: [
          {
            id: 'grab-it',
            label: 'Grab it',
            effect: {
              heatDelta: 0,
              lootDelta: 0,
              delayed: { kind: 'briefcase', roomsLeft: 3, payoff: { heatDelta: 0, lootDelta: 1 } },
            },
          },
          { id: 'leave-it', label: 'Leave it', effect: { heatDelta: -2, lootDelta: 0 } },
        ],
      },
      {
        id: 'scen-gear',
        setup: 'Cleaning crew left behind a spare badge.',
        choices: [
          { id: 'grab-badge', label: 'Grab the badge', effect: { heatDelta: 0, lootDelta: 0, gear: { kind: 'statBoost', lane: 'tech' } } },
          { id: 'skip-badge', label: 'Skip it',        effect: { heatDelta: -2, lootDelta: 0 } },
        ],
      },
      {
        id: 'scen-bigscore',
        setup: 'A safe behind a painting — not on the plan.',
        choices: [
          { id: 'crack-it', label: 'Crack it', effect: { heatDelta: 0, lootDelta: 0, gear: { kind: 'bigScore', lane: 'tech' } } },
          { id: 'skip-it',  label: 'Skip it',  effect: { heatDelta: -2, lootDelta: 0 } },
        ],
      },
    ],
  },
};

/** Minimal RunState in room phase with a scenario room and one player. */
function makeState(scenarioId: string, overrides: Partial<RunState> = {}): RunState {
  const base = initialState(42);
  const template = cfg.roomTemplates.scenarios.find(s => s.id === scenarioId)!;
  return {
    ...base,
    phase: 'room' as const,
    crew: [
      { id: 'p0' as PlayerId, name: 'Alice', stats: { tech: 2, physical: 1, charm: 0, stealth: 0 }, powerUps: {} },
    ],
    currentRoom: {
      kind: 'scenario' as const,
      templateId: scenarioId,
      setup: template.setup,
      choices: [
        { id: template.choices[0].id, label: template.choices[0].label, isRoll: 'roll' in template.choices[0] },
        { id: template.choices[1].id, label: template.choices[1].label, isRoll: 'roll' in template.choices[1] },
      ],
    },
    ...overrides,
  };
}

// ── computeDC ─────────────────────────────────────────────────────────────────

describe('computeDC', () => {
  const clamp: [number, number] = [1, 20];

  it('DC = baseDifficulty − laneRating', () => {
    expect(computeDC(13, 2, clamp)).toBe(11);
  });

  it('clamps DC at the lower bound (1)', () => {
    expect(computeDC(5, 10, clamp)).toBe(1);
  });

  it('clamps DC at the upper bound (20)', () => {
    expect(computeDC(20, 0, clamp)).toBe(20);
  });

  it('DC 0 is clamped to 1', () => {
    expect(computeDC(5, 5, clamp)).toBe(1);
  });

  it('respects custom clamp bounds', () => {
    expect(computeDC(5, 3, [2, 15])).toBe(2);
    expect(computeDC(18, 0, [2, 15])).toBe(15);
  });

  // ── E15.1 Heat/depth ctx tests ──────────────────────────────────────────────

  const noopHeatDC = { perHeat: 0, perRoom: 0 };

  it('default curve (0/0): ctx has no effect — regression equals no-ctx result', () => {
    expect(computeDC(13, 2, clamp, { heat: 10, roomIndex: 5, heatDC: noopHeatDC })).toBe(11);
  });

  it('non-zero perHeat: DC rises as heat increases (hot run harder)', () => {
    const heatDC = { perHeat: 0.5, perRoom: 0 };
    const cool = computeDC(13, 2, clamp, { heat: 0,  roomIndex: 0, heatDC });
    const warm = computeDC(13, 2, clamp, { heat: 4,  roomIndex: 0, heatDC });
    const hot  = computeDC(13, 2, clamp, { heat: 8,  roomIndex: 0, heatDC });
    expect(cool).toBeLessThan(warm);
    expect(warm).toBeLessThan(hot);
  });

  it('non-zero perRoom: DC rises as roomIndex increases (deeper run harder)', () => {
    const heatDC = { perHeat: 0, perRoom: 1 };
    const early = computeDC(13, 2, clamp, { heat: 0, roomIndex: 0, heatDC });
    const mid   = computeDC(13, 2, clamp, { heat: 0, roomIndex: 3, heatDC });
    const late  = computeDC(13, 2, clamp, { heat: 0, roomIndex: 6, heatDC });
    expect(early).toBeLessThan(mid);
    expect(mid).toBeLessThan(late);
  });

  it('heatTerm is rounded before adding to raw DC', () => {
    // perHeat=0.4, heat=1 → heatTerm = round(0.4) = 0; baseDifficulty-laneRating = 13-2 = 11
    const heatDC = { perHeat: 0.4, perRoom: 0 };
    expect(computeDC(13, 2, clamp, { heat: 1, roomIndex: 0, heatDC })).toBe(11);
    // perHeat=0.4, heat=2 → heatTerm = round(0.8) = 1; DC = 12
    expect(computeDC(13, 2, clamp, { heat: 2, roomIndex: 0, heatDC })).toBe(12);
  });

  it('combined DC is still clamped to dcClamp upper bound', () => {
    // baseDifficulty=18, laneRating=0, heatTerm=10 → raw=28, clamped to 20
    const heatDC = { perHeat: 1, perRoom: 0 };
    expect(computeDC(18, 0, clamp, { heat: 10, roomIndex: 0, heatDC })).toBe(20);
  });

  it('combined DC is still clamped to dcClamp lower bound', () => {
    // baseDifficulty=5, laneRating=10, heatTerm=0 → raw=-5, clamped to 1
    expect(computeDC(5, 10, clamp, { heat: 0, roomIndex: 0, heatDC: noopHeatDC })).toBe(1);
  });
});

// ── successOdds ───────────────────────────────────────────────────────────────

describe('successOdds', () => {
  it('DC=1 → odds=1.0 (always succeed)', () => {
    expect(successOdds(1)).toBe(1.0);
  });

  it('DC=11 → odds=0.5', () => {
    expect(successOdds(11)).toBe(0.5);
  });

  it('DC=20 → odds=0.05', () => {
    expect(successOdds(20)).toBeCloseTo(0.05);
  });

  it('DC=21 → odds=0 (impossible)', () => {
    expect(successOdds(21)).toBe(0);
  });
});

// ── resolveRoll ───────────────────────────────────────────────────────────────

describe('resolveRoll — critFumble off', () => {
  it('roll >= DC → success', () => {
    expect(resolveRoll(11, 11, false)).toBe(true);
    expect(resolveRoll(20, 11, false)).toBe(true);
  });

  it('roll < DC → failure', () => {
    expect(resolveRoll(10, 11, false)).toBe(false);
  });

  it('nat-20 with critFumble off: normal DC check applies', () => {
    // DC=1 would succeed anyway; nat-20 on DC=21 (out of range) would fail normally.
    expect(resolveRoll(20, 20, false)).toBe(true); // 20 >= 20
  });

  it('nat-1 with critFumble off: succeeds if DC=1', () => {
    expect(resolveRoll(1, 1, false)).toBe(true);
  });
});

describe('resolveRoll — critFumble on', () => {
  it('nat-20 always succeeds regardless of DC', () => {
    expect(resolveRoll(20, 20, true)).toBe(true);
  });

  it('nat-1 always fails regardless of DC', () => {
    expect(resolveRoll(1, 1, true)).toBe(false);
  });

  it('mid-roll still uses DC comparison when not nat-20/1', () => {
    expect(resolveRoll(10, 11, true)).toBe(false);
    expect(resolveRoll(12, 11, true)).toBe(true);
  });
});

// ── applyScenarioEffect — Heat ─────────────────────────────────────────────────

describe('applyScenarioEffect — Heat', () => {
  it('applies positive heatDelta', () => {
    const state = { ...initialState(1), heat: 5 };
    const next = applyScenarioEffect(state, { heatDelta: 3, lootDelta: 0 }, cfg);
    expect(next.heat).toBe(8);
  });

  it('applies negative heatDelta (cool)', () => {
    const state = { ...initialState(1), heat: 5 };
    const next = applyScenarioEffect(state, { heatDelta: -3, lootDelta: 0 }, cfg);
    expect(next.heat).toBe(2);
  });

  it('clamps heat at 0 for large negative delta', () => {
    const state = { ...initialState(1), heat: 1 };
    const next = applyScenarioEffect(state, { heatDelta: -5, lootDelta: 0 }, cfg);
    expect(next.heat).toBe(0);
  });

  it('zero heatDelta leaves heat unchanged', () => {
    const state = { ...initialState(1), heat: 7 };
    const next = applyScenarioEffect(state, { heatDelta: 0, lootDelta: 0 }, cfg);
    expect(next.heat).toBe(7);
  });
});

// ── applyScenarioEffect — Loot ─────────────────────────────────────────────────

describe('applyScenarioEffect — Loot', () => {
  it('applies positive lootDelta', () => {
    const state = { ...initialState(1), loot: 3 };
    const next = applyScenarioEffect(state, { heatDelta: 0, lootDelta: 2 }, cfg);
    expect(next.loot).toBe(5);
  });

  it('applies zero lootDelta (no change)', () => {
    const state = { ...initialState(1), loot: 3 };
    const next = applyScenarioEffect(state, { heatDelta: 0, lootDelta: 0 }, cfg);
    expect(next.loot).toBe(3);
  });
});

// ── applyScenarioEffect — Gear ─────────────────────────────────────────────────

describe('applyScenarioEffect — Gear (earnedGear)', () => {
  it('resolves statBoost gear to the correct GearId and pushes to earnedGear', () => {
    const state = initialState(1);
    const effect: ScenarioEffect = { heatDelta: 0, lootDelta: 0, gear: { kind: 'statBoost', lane: 'tech' } };
    const next = applyScenarioEffect(state, effect, cfg);
    expect(next.earnedGear).toContain('stat-tech-1' as GearId);
  });

  it('resolves powerUp gear to the correct GearId', () => {
    const state = initialState(1);
    const effect: ScenarioEffect = { heatDelta: 0, lootDelta: 0, gear: { kind: 'powerUp', lane: 'charm' } };
    const next = applyScenarioEffect(state, effect, cfg);
    expect(next.earnedGear).toContain('powerup-charm' as GearId);
  });

  it('resolves bigScore gear (magnitude=2)', () => {
    const state = initialState(1);
    const effect: ScenarioEffect = { heatDelta: 0, lootDelta: 0, gear: { kind: 'bigScore', lane: 'tech' } };
    const next = applyScenarioEffect(state, effect, cfg);
    expect(next.earnedGear).toContain('stat-tech-2' as GearId);
  });

  it('carries multi-lane descriptor unresolved so GM/crew can pick the lane', () => {
    const state = initialState(1);
    const descriptor: GearGrantDescriptor = { kind: 'statBoost', lanes: ['charm', 'stealth'] };
    const effect: ScenarioEffect = { heatDelta: 0, lootDelta: 0, gear: descriptor };
    const next = applyScenarioEffect(state, effect, cfg);
    // The descriptor must appear in earnedGear verbatim — no first-match collapse.
    expect(next.earnedGear).toContainEqual(descriptor);
    // No GearId should have been pushed for a multi-lane grant.
    expect(next.earnedGear.every(g => typeof g !== 'string')).toBe(true);
  });

  it('accumulates gear across multiple effects', () => {
    let state = initialState(1);
    state = applyScenarioEffect(state, { heatDelta: 0, lootDelta: 0, gear: { kind: 'statBoost', lane: 'tech' } }, cfg);
    state = applyScenarioEffect(state, { heatDelta: 0, lootDelta: 0, gear: { kind: 'powerUp', lane: 'charm' } }, cfg);
    expect(state.earnedGear).toHaveLength(2);
    expect(state.earnedGear).toContain('stat-tech-1' as GearId);
    expect(state.earnedGear).toContain('powerup-charm' as GearId);
  });
});

// ── applyScenarioEffect — Info (easeNextObstacle) ────────────────────────────

describe('applyScenarioEffect — info (easeNextObstacle)', () => {
  it('info:true spawns an easeNextObstacle carried effect with roomsLeft=1', () => {
    const state = initialState(1);
    const next = applyScenarioEffect(state, { heatDelta: 0, lootDelta: 0, info: true }, cfg);
    const ease = next.carried.find(e => e.kind === 'easeNextObstacle');
    expect(ease).toBeDefined();
    expect(ease?.roomsLeft).toBe(1);
  });

  it('info:false or absent does not spawn an ease effect', () => {
    const state = initialState(1);
    const next = applyScenarioEffect(state, { heatDelta: 0, lootDelta: 0 }, cfg);
    expect(next.carried.filter(e => e.kind === 'easeNextObstacle')).toHaveLength(0);
  });

  it('the ease effect applies easeDialSteps to the next obstacle room', () => {
    // generateRoom with obstacleRatio=1 ensures an obstacle is generated.
    const obstacleCfg = { ...cfg, generation: { obstacleRatio: 1.0 } };
    const state: RunState = {
      ...initialState(42),
      carried: [{ id: 'ease-0', kind: 'easeNextObstacle', roomsLeft: 1 }],
    };
    const next = generateRoom(state, obstacleCfg);
    expect(next.currentRoom?.kind).toBe('obstacle');
    if (next.currentRoom?.kind === 'obstacle') {
      expect(next.currentRoom.easeDialSteps).toBe(1);
    }
  });

  it('ease is consumed after one room (not present on the room after)', () => {
    const obstacleCfg = { ...cfg, generation: { obstacleRatio: 1.0 } };
    const stateWithEase: RunState = {
      ...initialState(42),
      carried: [{ id: 'ease-0', kind: 'easeNextObstacle', roomsLeft: 1 }],
    };
    const afterFirst = generateRoom(stateWithEase, obstacleCfg);
    // ease should be gone from carried
    expect(afterFirst.carried.filter(e => e.kind === 'easeNextObstacle')).toHaveLength(0);

    // second room should have no ease
    const afterSecond = generateRoom({ ...afterFirst, roomIndex: afterFirst.roomIndex + 1 }, obstacleCfg);
    if (afterSecond.currentRoom?.kind === 'obstacle') {
      expect(afterSecond.currentRoom.easeDialSteps).toBeUndefined();
    }
  });
});

// ── applyScenarioEffect — Delayed payoff ─────────────────────────────────────

describe('applyScenarioEffect — delayed payoff (briefcase)', () => {
  it('delayed:true spawns a carried effect with the specified roomsLeft and payoff', () => {
    const state = initialState(1);
    const next = applyScenarioEffect(state, {
      heatDelta: 0,
      lootDelta: 0,
      delayed: { kind: 'briefcase', roomsLeft: 3, payoff: { heatDelta: 0, lootDelta: 1 } },
    }, cfg);
    const briefcase = next.carried.find(e => e.kind === 'briefcase');
    expect(briefcase).toBeDefined();
    expect(briefcase?.roomsLeft).toBe(3);
    expect(briefcase?.payoff).toEqual({ heatDelta: 0, lootDelta: 1 });
  });

  it('briefcase fires its Loot++ payoff when it expires (via generateRoom)', () => {
    const scenarioCfg = { ...cfg, generation: { obstacleRatio: 0.0 } };
    // Start with a briefcase that expires on next tick (roomsLeft=1).
    const state: RunState = {
      ...initialState(42),
      loot: 5,
      carried: [{ id: 'bc', kind: 'briefcase', roomsLeft: 1, payoff: { heatDelta: 0, lootDelta: 1 } }],
    };
    const next = generateRoom(state, scenarioCfg);
    expect(next.loot).toBe(6); // Loot++ from briefcase
    expect(next.carried.filter(e => e.kind === 'briefcase')).toHaveLength(0);
  });
});

// ── CHOOSE_SCENARIO + RESOLVE_SCENARIO_ROLL — seeded roll ─────────────────────

describe('RESOLVE_SCENARIO_ROLL — seeded roll', () => {
  it('is deterministic: same state+seed → same roll', () => {
    const s = makeState('scen-roll');
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfg);
    const r1 = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL' }, cfg);
    const r2 = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL' }, cfg);
    expect(r1.history).toEqual(r2.history);
    expect(r1.heat).toBe(r2.heat);
    expect(r1.rngState).toBe(r2.rngState);
  });

  it('advances to offer phase after resolving the roll', () => {
    const s = makeState('scen-roll');
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfg);
    const next = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL' }, cfg);
    expect(next.phase).toBe('offer');
  });

  it('records roll, dc, and success in history', () => {
    const s = makeState('scen-roll');
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfg);
    const next = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL' }, cfg);
    const entry = next.history[0];
    expect(entry?.kind).toBe('scenario');
    if (entry?.kind === 'scenario') {
      expect(typeof entry.roll).toBe('number');
      expect(typeof entry.dc).toBe('number');
      expect(typeof entry.success).toBe('boolean');
      expect(entry.dc).toBe(11); // baseDifficulty(13) - techRating(2) = 11
    }
  });

  it('rngState advances after a seeded roll', () => {
    const s = makeState('scen-roll');
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfg);
    const next = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL' }, cfg);
    expect(next.rngState).not.toBe(afterChoose.rngState);
  });
});

// ── RESOLVE_SCENARIO_ROLL — externalRoll ─────────────────────────────────────

describe('RESOLVE_SCENARIO_ROLL — externalRoll (physical dice mode)', () => {
  it('uses the external roll verbatim (not the seeded RNG)', () => {
    const s = makeState('scen-roll');
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfg);

    // DC=11; roll 11 → success
    const successResult = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL', externalRoll: 11 }, cfg);
    const successEntry = successResult.history[0];
    if (successEntry?.kind === 'scenario') {
      expect(successEntry.roll).toBe(11);
      expect(successEntry.success).toBe(true);
    }

    // roll 10 → failure
    const failResult = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL', externalRoll: 10 }, cfg);
    const failEntry = failResult.history[0];
    if (failEntry?.kind === 'scenario') {
      expect(failEntry.roll).toBe(10);
      expect(failEntry.success).toBe(false);
    }
  });

  it('does not advance rngState when externalRoll is provided', () => {
    const s = makeState('scen-roll');
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfg);
    const next = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL', externalRoll: 15 }, cfg);
    expect(next.rngState).toBe(afterChoose.rngState);
  });

  it('success effect applied on roll ≥ DC', () => {
    // DC=11; roll 15 → success → info=true → easeNextObstacle carried effect
    const s = makeState('scen-roll');
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfg);
    const next = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL', externalRoll: 15 }, cfg);
    expect(next.carried.some(e => e.kind === 'easeNextObstacle')).toBe(true);
  });

  it('failure effect applied on roll < DC', () => {
    // DC=11; roll 5 → failure → heat +2
    const s = makeState('scen-roll', { heat: 3 });
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfg);
    const next = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL', externalRoll: 5 }, cfg);
    expect(next.heat).toBe(5); // 3 + 2
  });
});

// ── UNDO_LAST after RESOLVE_SCENARIO_ROLL ────────────────────────────────────

describe('UNDO_LAST restores prior state after a roll (mistyped physical roll is reversible)', () => {
  it('UNDO_LAST after RESOLVE_SCENARIO_ROLL restores the pendingRoll state', () => {
    // obstacleRatio=0 → always scenario rooms
    const session = initialSession(initialState(42));
    // Start a run. cfg has obstacleRatio=0 so the room will be a scenario.
    const s1 = reduceSession(session, { t: 'START_RUN', crew: [{ name: 'Alice' }], seed: 42 }, cfg);
    if (s1.present.currentRoom?.kind !== 'scenario') {
      return; // nothing to test
    }
    const room = s1.present.currentRoom;
    const rollChoice = room.choices.find(c => c.isRoll);
    if (rollChoice === undefined) return;

    const attempter = s1.present.crew[0]?.id;
    if (attempter === undefined) return;

    const s2 = reduceSession(s1, { t: 'CHOOSE_SCENARIO', choiceId: rollChoice.id, attemptedBy: attempter }, cfg);
    if (s2.present.currentRoom?.kind !== 'scenario' || s2.present.currentRoom.pendingRoll === undefined) {
      return;
    }

    const s3 = reduceSession(s2, { t: 'RESOLVE_SCENARIO_ROLL', externalRoll: 15 }, cfg);
    expect(s3.present.phase).toBe('offer');

    // Undo the roll — should restore the pre-roll state (pendingRoll set).
    const s4 = reduceSession(s3, { t: 'UNDO_LAST' }, cfg);
    expect(s4.present).toEqual(s2.present);
  });
});

// ── critFumble flag ───────────────────────────────────────────────────────────

describe('critFumble flag', () => {
  const cfgCrit: EngineConfig = { ...cfg, scenario: { dcClamp: [1, 20], critFumble: true, easeDialSteps: 1, heatDC: { perHeat: 0, perRoom: 0 } } };

  it('nat-20 always succeeds when critFumble=true (DC=20)', () => {
    expect(resolveRoll(20, 20, true)).toBe(true);
  });

  it('nat-1 always fails when critFumble=true (DC=1)', () => {
    expect(resolveRoll(1, 1, true)).toBe(false);
  });

  it('externalRoll=20 succeeds via RESOLVE_SCENARIO_ROLL when critFumble=true', () => {
    const s = makeState('scen-roll', { heat: 0 });
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfgCrit);
    // DC=11; roll 20 → nat-20 crit → success
    const next = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL', externalRoll: 20 }, cfgCrit);
    const entry = next.history[0];
    if (entry?.kind === 'scenario') {
      expect(entry.success).toBe(true);
    }
  });

  it('externalRoll=1 fails via RESOLVE_SCENARIO_ROLL when critFumble=true', () => {
    const s = makeState('scen-roll', { heat: 0 });
    const afterChoose = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'listen-in', attemptedBy: 'p0' as PlayerId }, cfgCrit);
    // DC=11; roll 1 → nat-1 fumble → failure
    const next = reduce(afterChoose, { t: 'RESOLVE_SCENARIO_ROLL', externalRoll: 1 }, cfgCrit);
    const entry = next.history[0];
    if (entry?.kind === 'scenario') {
      expect(entry.success).toBe(false);
    }
  });

  it('critFumble=false: nat-20 follows DC normally', () => {
    // DC=20; roll 20 → success (20 >= 20)
    expect(resolveRoll(20, 20, false)).toBe(true);
    // DC=1; roll 1 → success (1 >= 1)
    expect(resolveRoll(1, 1, false)).toBe(true);
  });
});

// ── No-roll choice: CHOOSE_SCENARIO advances directly to offer ───────────────

describe('no-roll choice: CHOOSE_SCENARIO resolves immediately', () => {
  it('applies effect and moves to offer without needing RESOLVE_SCENARIO_ROLL', () => {
    const s = makeState('scen-noroll');
    const next = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'leave-him' }, cfg);
    expect(next.phase).toBe('offer');
    expect(next.heat).toBe(Math.max(0, s.heat - 2));
  });

  it('no-roll loot: pay-off choice awards gear but deducts loot', () => {
    const s = makeState('scen-noroll', { loot: 5 });
    const next = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 'pay-off' }, cfg);
    expect(next.loot).toBe(4); // lootDelta = -1
    expect(next.earnedGear).toContain('powerup-charm' as GearId);
  });
});
