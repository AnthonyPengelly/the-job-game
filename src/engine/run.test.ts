import { describe, it, expect } from 'vitest';
import { initialState, startRun } from '@/engine/run';
import type { QuirkId, RunEvent } from '@/engine/types';
import type { EngineConfig } from '@/engine/config';

const FIXED_SEED = 1312;

const minimalCfg: EngineConfig = {
  heat: { hMax: 20, runAtFraction: 0.55 },
  escalation: { onsetRoom: 5, rampPerObstacle: 0.2 },
  obstacleHeat: { safe: 1, greedy: 2, greedyBelowFraction: 0.5 },
  outcomeHeat: { clean: 0, complication: 1, botched: 2 },
  outcomeLoot: { complication: 1, complicationFraction: 0.5, botched: 0 },
  scenarioSwing: { small: 2, big: 4 },
  getaway: {
    exponent: 1.3, skillTerm: 0.5, skillPivot: 0.65, headcountTerm: 0.8,
    clamp: [0.04, 0.97] as [number, number],
    brief: {
      lowHeat: { heat: 0, targetCards: 5, timerSeconds: 90 },
      highHeat: { heat: 20, targetCards: 12, timerSeconds: 45 },
    },
    ditchLootCost: 2000,
  },
  scoring: { winBaseMultiplier: 1.0, lowHeatStyleBonus: 0.5, bustMultiplier: 0.4 },
  scaling: {
    profiles: {
      '2': { getawayBonus: 0, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
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
  quirks: {
    'circuit-jockey': { id: 'circuit-jockey', name: 'Circuit Jockey', boosts: [{ lane: 'tech', magnitude: 2 }] },
    'cat-burglar':    { id: 'cat-burglar',    name: 'Cat Burglar',    boosts: [{ lane: 'tech', magnitude: 1 }, { lane: 'stealth', magnitude: 1 }] },
    'bruiser':        { id: 'bruiser',        name: 'Bruiser',        boosts: [{ lane: 'physical', magnitude: 2 }] },
    'spy':            { id: 'spy',            name: 'Spy',            boosts: [{ lane: 'charm', magnitude: 1 }, { lane: 'stealth', magnitude: 1 }] },
  },
  banks: { categories: [], trivia: [] },
  roomTemplates: { obstacles: [], scenarios: [] },
};

describe('initialState', () => {
  it('is deterministic: same seed produces identical RunState', () => {
    const a = initialState(FIXED_SEED);
    const b = initialState(FIXED_SEED);
    expect(a).toEqual(b);
  });

  it('sets rngState to seed >>> 0', () => {
    const state = initialState(FIXED_SEED);
    expect(state.rngState).toBe(FIXED_SEED >>> 0);
  });

  it('sets seed to seed >>> 0', () => {
    const state = initialState(FIXED_SEED);
    expect(state.seed).toBe(FIXED_SEED >>> 0);
  });

  it('starts in briefing phase with zero heat and loot', () => {
    const state = initialState(FIXED_SEED);
    expect(state.phase).toBe('briefing');
    expect(state.heat).toBe(0);
    expect(state.loot).toBe(0);
  });

  it('has empty crew, carried effects, and history', () => {
    const state = initialState(FIXED_SEED);
    expect(state.crew).toEqual([]);
    expect(state.carried).toEqual([]);
    expect(state.history).toEqual([]);
  });

  it('has no currentRoom and escapeSignal false', () => {
    const state = initialState(FIXED_SEED);
    expect(state.currentRoom).toBeNull();
    expect(state.escapeSignal).toBe(false);
  });

  it('normalises the seed with >>> 0 (handles large numbers)', () => {
    const large = 0xffffffff + 1; // overflows u32
    const state = initialState(large);
    expect(state.seed).toBe(large >>> 0);
    expect(state.rngState).toBe(large >>> 0);
  });
});

describe('startRun', () => {
  const crewEvent: Extract<RunEvent, { t: 'START_RUN' }> = {
    t: 'START_RUN',
    crew: [
      { name: 'Alice' },
      { name: 'Bob' },
    ],
  };

  it('is deterministic: same seed + same setup produces identical RunState', () => {
    const base = initialState(FIXED_SEED);
    const a = startRun(base, crewEvent, minimalCfg);
    const b = startRun(base, crewEvent, minimalCfg);
    expect(a).toEqual(b);
  });

  it('creates one Player per crew setup entry', () => {
    const state = startRun(initialState(FIXED_SEED), crewEvent, minimalCfg);
    expect(state.crew).toHaveLength(2);
    expect(state.crew[0]?.name).toBe('Alice');
    expect(state.crew[1]?.name).toBe('Bob');
  });

  it('assigns sequential player IDs', () => {
    const state = startRun(initialState(FIXED_SEED), crewEvent, minimalCfg);
    expect(state.crew[0]?.id).toBe('player-0');
    expect(state.crew[1]?.id).toBe('player-1');
  });

  it('initialises player stats to the mediocre baseline when no quirk is set', () => {
    const state = startRun(initialState(FIXED_SEED), crewEvent, minimalCfg);
    for (const player of state.crew) {
      expect(player.stats).toEqual({ tech: 0, physical: 0, charm: 0, stealth: 0 });
      expect(player.powerUps).toEqual({});
    }
  });

  it('stores a supplied quirk and leaves quirk undefined when absent', () => {
    const eventWithQuirk: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Zara', quirk: 'hacker' as QuirkId }],
    };
    const withQuirk = startRun(initialState(FIXED_SEED), eventWithQuirk, minimalCfg);
    expect(withQuirk.crew[0]?.quirk).toBe('hacker');

    const withoutQuirk = startRun(initialState(FIXED_SEED), crewEvent, minimalCfg);
    expect(withoutQuirk.crew[0]?.quirk).toBeUndefined();
  });

  it('advances rngState (different from the initial seed)', () => {
    const base = initialState(FIXED_SEED);
    const after = startRun(base, crewEvent, minimalCfg);
    // rngState must have been advanced by the mansion pick
    expect(after.rngState).not.toBe(base.rngState);
  });

  it('assigns a valid mansion type', () => {
    const state = startRun(initialState(FIXED_SEED), crewEvent, minimalCfg);
    expect(['villa', 'estate', 'penthouse']).toContain(state.mansion.type);
  });

  it('mansion type is deterministic for the same seed', () => {
    const a = startRun(initialState(FIXED_SEED), crewEvent, minimalCfg);
    const b = startRun(initialState(FIXED_SEED), crewEvent, minimalCfg);
    expect(a.mansion.type).toBe(b.mansion.type);
  });

  it('uses the event seed when provided, overriding state seed', () => {
    const base = initialState(FIXED_SEED);
    const eventWithSeed: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Dana' }],
      seed: 9999,
    };
    const state = startRun(base, eventWithSeed, minimalCfg);
    expect(state.seed).toBe(9999 >>> 0);
  });

  it('seed override drives the RNG stream — replay via initialState(override) is identical', () => {
    const OVERRIDE_SEED = 9999;
    const eventWithSeed: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Dana' }],
      seed: OVERRIDE_SEED,
    };
    // Path A: start from a different initial seed and override in the event
    const fromOverride = startRun(initialState(FIXED_SEED), eventWithSeed, minimalCfg);
    // Path B: start fresh from the override seed with no seed field
    const fromFreshSeed = startRun(initialState(OVERRIDE_SEED), { t: 'START_RUN', crew: [{ name: 'Dana' }] }, minimalCfg);
    // Both paths must produce identical mansion and rngState — same seed → same stream
    expect(fromOverride.mansion.type).toBe(fromFreshSeed.mansion.type);
    expect(fromOverride.rngState).toBe(fromFreshSeed.rngState);
    expect(fromOverride.seed).toBe(fromFreshSeed.seed);
  });

  it('seed override produces a different mansion than the base seed when seeds differ', () => {
    const eventDefault: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Dana' }],
    };
    const eventOverride: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Dana' }],
      seed: 0xdeadbeef,
    };
    const base = initialState(FIXED_SEED);
    const fromBase = startRun(base, eventDefault, minimalCfg);
    const fromOverride = startRun(base, eventOverride, minimalCfg);
    // Different seeds must drive different RNG streams (rngState diverges)
    expect(fromOverride.rngState).not.toBe(fromBase.rngState);
  });

  it('resets all transient state on a fresh run', () => {
    // Even if we call startRun on a "used" state, transient fields reset
    const dirty = {
      ...initialState(FIXED_SEED),
      heat: 15,
      loot: 8,
      roomIndex: 3,
      obstacleCount: 5,
      escapeSignal: true,
    };
    const fresh = startRun(dirty, crewEvent, minimalCfg);
    expect(fresh.heat).toBe(0);
    expect(fresh.loot).toBe(0);
    expect(fresh.roomIndex).toBe(0);
    expect(fresh.obstacleCount).toBe(0);
    expect(fresh.escapeSignal).toBe(false);
    expect(fresh.currentRoom).toBeNull();
    expect(fresh.carried).toEqual([]);
    expect(fresh.history).toEqual([]);
  });
});

describe('initialState — crewName', () => {
  it('initialises crewName to empty string', () => {
    const state = initialState(FIXED_SEED);
    expect(state.crewName).toBe('');
  });
});

describe('startRun — crewName', () => {
  it('copies crewName from the event into RunState', () => {
    const event: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Alice' }],
      crewName: 'The Magpies',
    };
    const state = startRun(initialState(FIXED_SEED), event, minimalCfg);
    expect(state.crewName).toBe('The Magpies');
  });

  it('defaults crewName to empty string when absent from the event', () => {
    const event: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Alice' }],
    };
    const state = startRun(initialState(FIXED_SEED), event, minimalCfg);
    expect(state.crewName).toBe('');
  });

  it('preserves crewName through deterministic replay', () => {
    const event: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Alice' }],
      crewName: 'The Foxes',
    };
    const a = startRun(initialState(FIXED_SEED), event, minimalCfg);
    const b = startRun(initialState(FIXED_SEED), event, minimalCfg);
    expect(a.crewName).toBe(b.crewName);
  });
});

describe('startRun — quirk boost application', () => {
  it('applies a single-lane +2 quirk to player stats', () => {
    const event: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Alice', quirk: 'circuit-jockey' as QuirkId }],
    };
    const state = startRun(initialState(FIXED_SEED), event, minimalCfg);
    expect(state.crew[0]?.stats).toEqual({ tech: 2, physical: 0, charm: 0, stealth: 0 });
  });

  it('applies a two-lane +1/+1 quirk to player stats', () => {
    const event: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Bob', quirk: 'cat-burglar' as QuirkId }],
    };
    const state = startRun(initialState(FIXED_SEED), event, minimalCfg);
    expect(state.crew[0]?.stats).toEqual({ tech: 1, physical: 0, charm: 0, stealth: 1 });
  });

  it('applies boosts independently to each player', () => {
    const event: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [
        { name: 'Alice', quirk: 'bruiser' as QuirkId },
        { name: 'Bob',   quirk: 'spy' as QuirkId },
        { name: 'Carol' },
      ],
    };
    const state = startRun(initialState(FIXED_SEED), event, minimalCfg);
    expect(state.crew[0]?.stats).toEqual({ tech: 0, physical: 2, charm: 0, stealth: 0 });
    expect(state.crew[1]?.stats).toEqual({ tech: 0, physical: 0, charm: 1, stealth: 1 });
    expect(state.crew[2]?.stats).toEqual({ tech: 0, physical: 0, charm: 0, stealth: 0 });
  });

  it('falls back to mediocre baseline for an unknown quirk (no dead-end)', () => {
    const event: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Zara', quirk: 'not-a-real-quirk' as QuirkId }],
    };
    const state = startRun(initialState(FIXED_SEED), event, minimalCfg);
    expect(state.crew[0]?.stats).toEqual({ tech: 0, physical: 0, charm: 0, stealth: 0 });
    // The quirk id is still stored on the player
    expect(state.crew[0]?.quirk).toBe('not-a-real-quirk');
  });

  it('falls back to mediocre baseline when no quirk is supplied', () => {
    const event: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Dana' }],
    };
    const state = startRun(initialState(FIXED_SEED), event, minimalCfg);
    expect(state.crew[0]?.stats).toEqual({ tech: 0, physical: 0, charm: 0, stealth: 0 });
  });

  it('quirk boosts are deterministic (same inputs → same stats)', () => {
    const event: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Alice', quirk: 'circuit-jockey' as QuirkId }],
    };
    const a = startRun(initialState(FIXED_SEED), event, minimalCfg);
    const b = startRun(initialState(FIXED_SEED), event, minimalCfg);
    expect(a.crew[0]?.stats).toEqual(b.crew[0]?.stats);
  });
});
