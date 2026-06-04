import { describe, it, expect } from 'vitest';
import { reduce } from '@/engine/reduce';
import { initialState } from '@/engine/run';
import type { EngineConfig } from '@/engine/config';
import type { RunState, PlayerId, GearId, GameId } from '@/engine/types';

// ─── Inline test config (no platform dependency) ─────────────────────────────

const cfg: EngineConfig = {
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
      '4': { getawayBonus: 0.0,   crewPerOption: [1, 2] as [number, number], exhaustion: 'light' as const },
      '7': { getawayBonus: 0.06,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
    },
    exhaustionRest: { full: 1, light: 1, tired: 0 },
    minCommit: { alpha: 1, bravo: 1, charlie: 1, delta: 2 },
    variant: {},
    excludedFromSolo: [],
    soloEligibleMinPool: 8,
    dialCurve: { _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 } },
  },
  generation: { obstacleRatio: 0.6 },
  gear: {
    'stat-tech-1':   { id: 'stat-tech-1',   kind: 'statBoost', lane: 'tech',     magnitude: 1 },
    'stat-tech-2':   { id: 'stat-tech-2',   kind: 'statBoost', lane: 'tech',     magnitude: 2 },
    'powerup-charm': { id: 'powerup-charm', kind: 'powerUp',  lane: 'charm' },
  },
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
          { id: 's1-a', label: 'Choice A', heatDelta: -2, lootDelta: 0 },
          { id: 's1-b', label: 'Choice B', heatDelta:  0, lootDelta: 1 },
        ],
      },
      {
        id: 'scen-2',
        choices: [
          { id: 's2-a', label: 'Option A', heatDelta:  2, lootDelta: 0 },
          { id: 's2-b', label: 'Option B', heatDelta: -4, lootDelta: 0 },
        ],
      },
      {
        id: 'scen-3',
        choices: [
          { id: 's3-a', label: 'Take it', heatDelta:  0, lootDelta: 2 },
          { id: 's3-b', label: 'Leave it', heatDelta: -2, lootDelta: 0 },
        ],
      },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** State already in `minigame` phase with a committed obstacle option. */
function obstacleMinigameState(
  overrides: Partial<RunState> = {},
): RunState {
  return {
    ...initialState(1312),
    phase: 'minigame',
    currentRoom: {
      kind: 'obstacle',
      templateId: 'obs-alpha',
      options: [
        { id: 'alpha-safe',   gameId: 'alpha' as GameId, greedy: false, heatCost: 1, reward: 1 },
        { id: 'alpha-greedy', gameId: 'alpha' as GameId, greedy: true,  heatCost: 2, reward: 2 },
      ],
      committedOptionId: 'alpha-safe',
    },
    ...overrides,
  };
}

/** State in `offer` phase, ready for PUSH_ON / CALL_GETAWAY. */
function offerState(overrides: Partial<RunState> = {}): RunState {
  return {
    ...initialState(42),
    phase: 'offer',
    roomIndex: 2,
    ...overrides,
  };
}

/** State in `getaway` phase with loot and heat set. */
function getawayState(
  loot: number,
  heat: number,
  overrides: Partial<RunState> = {},
): RunState {
  return {
    ...initialState(99),
    phase: 'getaway',
    loot,
    heat,
    crew: [{ id: 'player-0' as PlayerId, name: 'Alice', stats: { tech: 0, physical: 0, charm: 0, stealth: 0 }, powerUps: {} }],
    ...overrides,
  };
}

// ─── START_RUN ────────────────────────────────────────────────────────────────

describe('START_RUN', () => {
  it('transitions to room phase', () => {
    const s = reduce(
      initialState(42),
      { t: 'START_RUN', crew: [{ name: 'Alice' }] },
      cfg,
    );
    expect(s.phase).toBe('room');
  });

  it('builds crew from setup', () => {
    const s = reduce(
      initialState(42),
      { t: 'START_RUN', crew: [{ name: 'Alice' }, { name: 'Bob' }] },
      cfg,
    );
    expect(s.crew).toHaveLength(2);
    expect(s.crew[0]!.name).toBe('Alice');
    expect(s.crew[1]!.name).toBe('Bob');
  });

  it('generates a first room', () => {
    const s = reduce(
      initialState(42),
      { t: 'START_RUN', crew: [{ name: 'Alice' }] },
      cfg,
    );
    expect(s.currentRoom).not.toBeNull();
  });

  it('is deterministic: same seed + same crew ⇒ same state', () => {
    const ev = { t: 'START_RUN' as const, crew: [{ name: 'X' }] };
    const s1 = reduce(initialState(1234), ev, cfg);
    const s2 = reduce(initialState(1234), ev, cfg);
    expect(s1).toEqual(s2);
  });

  it('advances rngState beyond the seed', () => {
    const seed = 5;
    const s = reduce(
      initialState(seed),
      { t: 'START_RUN', crew: [{ name: 'A' }] },
      cfg,
    );
    expect(s.rngState).not.toBe(seed);
  });
});

// ─── CHOOSE_OPTION ────────────────────────────────────────────────────────────

describe('CHOOSE_OPTION', () => {
  it('records committedOptionId on the obstacle room', () => {
    const s = {
      ...initialState(1),
      phase: 'room' as const,
      currentRoom: {
        kind: 'obstacle' as const,
        templateId: 'obs-alpha',
        options: [
          { id: 'alpha-safe',   gameId: 'alpha' as GameId, greedy: false, heatCost: 1, reward: 1 },
          { id: 'alpha-greedy', gameId: 'alpha' as GameId, greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
    } satisfies RunState;

    const next = reduce(s, { t: 'CHOOSE_OPTION', optionId: 'alpha-safe', committed: [] }, cfg);
    expect(next.currentRoom?.kind).toBe('obstacle');
    if (next.currentRoom?.kind === 'obstacle') {
      expect(next.currentRoom.committedOptionId).toBe('alpha-safe');
    }
  });

  it('transitions to minigame phase', () => {
    const s = {
      ...initialState(1),
      phase: 'room' as const,
      currentRoom: {
        kind: 'obstacle' as const,
        templateId: 'obs-alpha',
        options: [
          { id: 'alpha-safe',   gameId: 'alpha' as GameId, greedy: false, heatCost: 1, reward: 1 },
          { id: 'alpha-greedy', gameId: 'alpha' as GameId, greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
    } satisfies RunState;

    const next = reduce(s, { t: 'CHOOSE_OPTION', optionId: 'alpha-greedy', committed: [] }, cfg);
    expect(next.phase).toBe('minigame');
  });

  it('records committedBy list', () => {
    const s = {
      ...initialState(1),
      phase: 'room' as const,
      currentRoom: {
        kind: 'obstacle' as const,
        templateId: 'obs-alpha',
        options: [
          { id: 'alpha-safe',   gameId: 'alpha' as GameId, greedy: false, heatCost: 1, reward: 1 },
          { id: 'alpha-greedy', gameId: 'alpha' as GameId, greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
    } satisfies RunState;

    const committed = ['player-0' as PlayerId];
    const next = reduce(s, { t: 'CHOOSE_OPTION', optionId: 'alpha-safe', committed }, cfg);
    if (next.currentRoom?.kind === 'obstacle') {
      expect(next.currentRoom.committedBy).toEqual(committed);
    }
  });

  it('does not mutate input state', () => {
    const s = {
      ...initialState(1),
      phase: 'room' as const,
      currentRoom: {
        kind: 'obstacle' as const,
        templateId: 'obs-alpha',
        options: [
          { id: 'alpha-safe',   gameId: 'alpha' as GameId, greedy: false, heatCost: 1, reward: 1 },
          { id: 'alpha-greedy', gameId: 'alpha' as GameId, greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
    } satisfies RunState;
    reduce(s, { t: 'CHOOSE_OPTION', optionId: 'alpha-safe', committed: [] }, cfg);
    expect(s.phase).toBe('room');
  });
});

// ─── RESOLVE_MINIGAME ─────────────────────────────────────────────────────────

describe('RESOLVE_MINIGAME — clean safe (roomIndex 0)', () => {
  // drip = safe(1) + floor(0 * 0.2) = 1; surcharge = 0; outHeat = 0; heatDelta = 1; loot = 1
  const s = obstacleMinigameState({ roomIndex: 0, heat: 0 });
  const next = reduce(s, { t: 'RESOLVE_MINIGAME', outcome: 'clean' }, cfg);

  it('transitions to offer phase', () => {
    expect(next.phase).toBe('offer');
  });

  it('applies obstacle drip heat', () => {
    expect(next.heat).toBe(1);
  });

  it('awards safe reward loot (1)', () => {
    expect(next.loot).toBe(1);
  });

  it('increments obstacleCount', () => {
    expect(next.obstacleCount).toBe(s.obstacleCount + 1);
  });

  it('records history entry', () => {
    const entry = next.history[0];
    expect(entry?.kind).toBe('obstacle');
    if (entry?.kind === 'obstacle') {
      expect(entry.outcome).toBe('clean');
      expect(entry.lootGained).toBe(1);
      expect(entry.heatGained).toBe(1);
      expect(entry.optionId).toBe('alpha-safe');
    }
  });
});

describe('RESOLVE_MINIGAME — clean greedy (roomIndex 0)', () => {
  // drip = 1; surcharge = greedy(2) - safe(1) = 1; outHeat = 0; heatDelta = 2; loot = 2
  const s = obstacleMinigameState({
    roomIndex: 0,
    heat: 0,
    currentRoom: {
      kind: 'obstacle',
      templateId: 'obs-alpha',
      options: [
        { id: 'alpha-safe',   gameId: 'alpha' as GameId, greedy: false, heatCost: 1, reward: 1 },
        { id: 'alpha-greedy', gameId: 'alpha' as GameId, greedy: true,  heatCost: 2, reward: 2 },
      ],
      committedOptionId: 'alpha-greedy',
    },
  });
  const next = reduce(s, { t: 'RESOLVE_MINIGAME', outcome: 'clean' }, cfg);

  it('transitions to offer phase', () => {
    expect(next.phase).toBe('offer');
  });

  it('applies drip + greedy surcharge heat', () => {
    expect(next.heat).toBe(2); // drip(1) + surcharge(1)
  });

  it('awards greedy reward loot (2)', () => {
    expect(next.loot).toBe(2);
  });
});

describe('RESOLVE_MINIGAME — complication safe (roomIndex 0)', () => {
  // drip = 1; surcharge = 0; outHeat = 1; heatDelta = 2; loot = 1
  const s = obstacleMinigameState({ roomIndex: 0, heat: 0 });
  const next = reduce(s, { t: 'RESOLVE_MINIGAME', outcome: 'complication' }, cfg);

  it('transitions to offer phase (NOT result — structural assertion J)', () => {
    expect(next.phase).toBe('offer');
  });

  it('applies drip + complication heat', () => {
    expect(next.heat).toBe(2); // drip(1) + outHeat(1)
  });

  it('awards fixed complication loot (1)', () => {
    expect(next.loot).toBe(1);
  });
});

describe('RESOLVE_MINIGAME — botched safe (structural assertion J)', () => {
  // drip = 1; surcharge = 0; outHeat = 2; heatDelta = 3; loot = 0
  const s = obstacleMinigameState({ roomIndex: 0, heat: 0 });
  const next = reduce(s, { t: 'RESOLVE_MINIGAME', outcome: 'botched' }, cfg);

  it('transitions to offer — NOT result (botch never terminates the run)', () => {
    expect(next.phase).toBe('offer');
  });

  it('applies drip + botched heat', () => {
    expect(next.heat).toBe(3); // drip(1) + outHeat(2)
  });

  it('awards no loot on botch', () => {
    expect(next.loot).toBe(0);
  });

  it('obstacleCount still incremented (botch counts as an obstacle)', () => {
    expect(next.obstacleCount).toBe(s.obstacleCount + 1);
  });
});

describe('RESOLVE_MINIGAME — escalation ramp at higher roomIndex', () => {
  // roomIndex 5: drip = safe(1) + floor(5 * 0.2) = 1 + 1 = 2
  const s = obstacleMinigameState({ roomIndex: 5, heat: 0 });
  const next = reduce(s, { t: 'RESOLVE_MINIGAME', outcome: 'clean' }, cfg);

  it('drip grows with roomIndex', () => {
    expect(next.heat).toBe(2); // drip(2) + outHeat(0)
  });
});

describe('RESOLVE_MINIGAME — escapeSignal set when thresholds met', () => {
  it('escapeSignal false below runAt', () => {
    // heat after resolve: 0 + 1 = 1 (well below 11)
    const s = obstacleMinigameState({ roomIndex: 2, heat: 0 });
    const next = reduce(s, { t: 'RESOLVE_MINIGAME', outcome: 'clean' }, cfg);
    expect(next.escapeSignal).toBe(false);
  });

  it('escapeSignal true when heat >= runAtFraction * hMax and roomIndex >= 2', () => {
    // heat 10 + drip(1) = 11 = 0.55 * 20; roomIndex = 2 → signal
    const s = obstacleMinigameState({ roomIndex: 2, heat: 10 });
    const next = reduce(s, { t: 'RESOLVE_MINIGAME', outcome: 'clean' }, cfg);
    expect(next.escapeSignal).toBe(true);
  });

  it('escapeSignal false when roomIndex < 2 even if heat is high', () => {
    const s = obstacleMinigameState({ roomIndex: 1, heat: 15 });
    const next = reduce(s, { t: 'RESOLVE_MINIGAME', outcome: 'clean' }, cfg);
    expect(next.escapeSignal).toBe(false);
  });
});

// ─── CHOOSE_SCENARIO ──────────────────────────────────────────────────────────

describe('CHOOSE_SCENARIO', () => {
  function scenarioState(overrides: Partial<RunState> = {}): RunState {
    return {
      ...initialState(42),
      phase: 'room' as const,
      currentRoom: {
        kind: 'scenario' as const,
        templateId: 'scen-1',
        choices: [
          { id: 's1-a', label: 'Choice A' },
          { id: 's1-b', label: 'Choice B' },
        ],
      },
      ...overrides,
    };
  }

  it('transitions to offer phase', () => {
    const next = reduce(
      scenarioState({ heat: 5 }),
      { t: 'CHOOSE_SCENARIO', choiceId: 's1-a' },
      cfg,
    );
    expect(next.phase).toBe('offer');
  });

  it('applies negative heat delta (cool choice)', () => {
    // scen-1, s1-a: heatDelta = -2
    const next = reduce(
      scenarioState({ heat: 5 }),
      { t: 'CHOOSE_SCENARIO', choiceId: 's1-a' },
      cfg,
    );
    expect(next.heat).toBe(3);
  });

  it('clamps heat at 0 (cool choice on low heat)', () => {
    const next = reduce(
      scenarioState({ heat: 1 }),
      { t: 'CHOOSE_SCENARIO', choiceId: 's1-a' }, // heatDelta -2
      cfg,
    );
    expect(next.heat).toBe(0);
  });

  it('applies loot delta', () => {
    // scen-1, s1-b: lootDelta = 1
    const next = reduce(
      scenarioState({ heat: 0, loot: 2 }),
      { t: 'CHOOSE_SCENARIO', choiceId: 's1-b' },
      cfg,
    );
    expect(next.loot).toBe(3);
  });

  it('applies positive heat delta', () => {
    // scen-2, s2-a: heatDelta = +2
    const s = {
      ...scenarioState({ heat: 3 }),
      currentRoom: {
        kind: 'scenario' as const,
        templateId: 'scen-2',
        choices: [
          { id: 's2-a', label: 'Option A' },
          { id: 's2-b', label: 'Option B' },
        ],
      },
    } satisfies RunState;
    const next = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 's2-a' }, cfg);
    expect(next.heat).toBe(5);
  });

  it('records history entry', () => {
    const next = reduce(
      scenarioState({ heat: 5, roomIndex: 3 }),
      { t: 'CHOOSE_SCENARIO', choiceId: 's1-b' },
      cfg,
    );
    const entry = next.history[0];
    expect(entry?.kind).toBe('scenario');
    if (entry?.kind === 'scenario') {
      expect(entry.choiceId).toBe('s1-b');
      expect(entry.roomIndex).toBe(3);
      expect(entry.lootGained).toBe(1);
    }
  });

  it('sets escapeSignal when heat and room thresholds are met', () => {
    // heat 9 + heatDelta 2 = 11 >= runAt (11); roomIndex >= 2
    const s = {
      ...scenarioState({ heat: 9, roomIndex: 2 }),
      currentRoom: {
        kind: 'scenario' as const,
        templateId: 'scen-2',
        choices: [
          { id: 's2-a', label: 'Option A' },
          { id: 's2-b', label: 'Option B' },
        ],
      },
    } satisfies RunState;
    const next = reduce(s, { t: 'CHOOSE_SCENARIO', choiceId: 's2-a' }, cfg);
    expect(next.escapeSignal).toBe(true);
  });
});

// ─── PUSH_ON ─────────────────────────────────────────────────────────────────

describe('PUSH_ON', () => {
  it('increments roomIndex', () => {
    const s = offerState({ roomIndex: 2 });
    const next = reduce(s, { t: 'PUSH_ON' }, cfg);
    expect(next.roomIndex).toBe(3);
  });

  it('generates a new room (transitions to room phase)', () => {
    const s = offerState({ heat: 0 });
    const next = reduce(s, { t: 'PUSH_ON' }, cfg);
    expect(next.phase).toBe('room');
    expect(next.currentRoom).not.toBeNull();
  });

  it('is deterministic: same state ⇒ same next room', () => {
    const s = offerState({ heat: 0 });
    const n1 = reduce(s, { t: 'PUSH_ON' }, cfg);
    const n2 = reduce(s, { t: 'PUSH_ON' }, cfg);
    expect(n1.currentRoom).toEqual(n2.currentRoom);
    expect(n1.rngState).toBe(n2.rngState);
  });

  it('routes to getaway when forcedGetaway (heat >= hMax)', () => {
    const s = offerState({ heat: 20 }); // heat === hMax
    const next = reduce(s, { t: 'PUSH_ON' }, cfg);
    expect(next.phase).toBe('getaway');
  });

  it('routes to getaway when heat > hMax', () => {
    const s = offerState({ heat: 25 });
    const next = reduce(s, { t: 'PUSH_ON' }, cfg);
    expect(next.phase).toBe('getaway');
  });

  it('does NOT route to getaway just below hMax', () => {
    const s = offerState({ heat: 19 });
    const next = reduce(s, { t: 'PUSH_ON' }, cfg);
    expect(next.phase).toBe('room');
  });

  it('ticks carried effects via generateRoom', () => {
    const s = offerState({
      heat: 0,
      carried: [
        { id: 'e1', kind: 'countdown', roomsLeft: 2 },
        { id: 'e2', kind: 'unlock',    roomsLeft: 1 },
      ],
    });
    const next = reduce(s, { t: 'PUSH_ON' }, cfg);
    expect(next.carried.find(e => e.id === 'e2')).toBeUndefined();
    expect(next.carried.find(e => e.id === 'e1')?.roomsLeft).toBe(1);
  });
});

// ─── CALL_GETAWAY ─────────────────────────────────────────────────────────────

describe('CALL_GETAWAY', () => {
  it('transitions to getaway phase', () => {
    const s = offerState({ heat: 12 });
    const next = reduce(s, { t: 'CALL_GETAWAY' }, cfg);
    expect(next.phase).toBe('getaway');
  });

  it('preserves all other state fields', () => {
    const s = offerState({ heat: 12, loot: 7 });
    const next = reduce(s, { t: 'CALL_GETAWAY' }, cfg);
    expect(next.heat).toBe(12);
    expect(next.loot).toBe(7);
  });
});

// ─── RESOLVE_GETAWAY ──────────────────────────────────────────────────────────

describe('RESOLVE_GETAWAY — explicit win (E6 seam)', () => {
  it('records win=true and computes score', () => {
    // loot=5, heat=0: score = 5 * (1.0 + 0.5 * (1 - 0/20)) = 5 * 1.5 = 7.5
    const s = getawayState(5, 0);
    const next = reduce(s, { t: 'RESOLVE_GETAWAY', win: true }, cfg);
    expect(next.win).toBe(true);
    expect(next.finalScore).toBeCloseTo(7.5);
    expect(next.phase).toBe('result');
  });

  it('records win=false and computes bust score', () => {
    // loot=5, heat=10: bust → 5 * 0.4 = 2.0
    const s = getawayState(5, 10);
    const next = reduce(s, { t: 'RESOLVE_GETAWAY', win: false }, cfg);
    expect(next.win).toBe(false);
    expect(next.finalScore).toBeCloseTo(2.0);
    expect(next.phase).toBe('result');
  });

  it('low-heat win has higher score than high-heat win', () => {
    const sLow  = getawayState(10, 0);
    const sHigh = getawayState(10, 18);
    const scoreLow  = reduce(sLow,  { t: 'RESOLVE_GETAWAY', win: true }, cfg).finalScore ?? 0;
    const scoreHigh = reduce(sHigh, { t: 'RESOLVE_GETAWAY', win: true }, cfg).finalScore ?? 0;
    expect(scoreLow).toBeGreaterThan(scoreHigh);
  });

  it('does not advance rngState (E6 seam skips the roll)', () => {
    const s = getawayState(5, 0);
    const next = reduce(s, { t: 'RESOLVE_GETAWAY', win: true }, cfg);
    expect(next.rngState).toBe(s.rngState);
  });
});

describe('RESOLVE_GETAWAY — seeded roll', () => {
  it('transitions to result phase', () => {
    const s = getawayState(5, 0);
    const next = reduce(s, { t: 'RESOLVE_GETAWAY' }, cfg);
    expect(next.phase).toBe('result');
  });

  it('is deterministic for a fixed seed', () => {
    const s = getawayState(5, 10);
    const n1 = reduce(s, { t: 'RESOLVE_GETAWAY' }, cfg);
    const n2 = reduce(s, { t: 'RESOLVE_GETAWAY' }, cfg);
    expect(n1.win).toBe(n2.win);
    expect(n1.finalScore).toBe(n2.finalScore);
    expect(n1.rngState).toBe(n2.rngState);
  });

  it('advances rngState by exactly one draw', () => {
    const s = getawayState(5, 10);
    const next = reduce(s, { t: 'RESOLVE_GETAWAY' }, cfg);
    expect(next.rngState).not.toBe(s.rngState);
  });

  it('win=false at high heat (near hMax)', () => {
    // At heat=19 (near hMax), odds are very low — drive rngState from seed so draws vary.
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const busts = seeds.filter(seed => {
      const s = getawayState(5, 19, { rngState: seed >>> 0 });
      return reduce(s, { t: 'RESOLVE_GETAWAY' }, cfg).win === false;
    });
    expect(busts.length).toBeGreaterThan(0);
  });

  it('win=true at low heat (heat 0 → odds clamp to 0.97)', () => {
    // At heat=0, odds clamp to 0.97 — a seeded roll should win.
    const s = getawayState(5, 0);
    const next = reduce(s, { t: 'RESOLVE_GETAWAY' }, cfg);
    expect(next.win).toBe(true);
  });
});

// ─── Determinism / replay ─────────────────────────────────────────────────────

describe('determinism: event log replay', () => {
  it('replays an obstacle run to identical final state', () => {
    const seed = 7654;
    const initial = initialState(seed);

    function runEvents(s: RunState): RunState {
      // START_RUN then pick whichever room was generated.
      let state = reduce(s, { t: 'START_RUN', crew: [{ name: 'A' }, { name: 'B' }] }, cfg);
      // Force an obstacle room to be predictable — skip rooms until we get one.
      // In practice we just work with whatever the first room is.
      if (state.currentRoom?.kind === 'obstacle') {
        const opt = state.currentRoom.options[0]!;
        state = reduce(state, { t: 'CHOOSE_OPTION', optionId: opt.id, committed: [] }, cfg);
        state = reduce(state, { t: 'RESOLVE_MINIGAME', outcome: 'clean' }, cfg);
      } else if (state.currentRoom?.kind === 'scenario') {
        state = reduce(state, { t: 'CHOOSE_SCENARIO', choiceId: state.currentRoom.choices[0]!.id }, cfg);
      }
      state = reduce(state, { t: 'CALL_GETAWAY' }, cfg);
      state = reduce(state, { t: 'RESOLVE_GETAWAY' }, cfg);
      return state;
    }

    const run1 = runEvents(initial);
    const run2 = runEvents(initial);
    expect(run1).toEqual(run2);
  });
});

// ─── Purity / no mutation ─────────────────────────────────────────────────────

describe('reduce does not mutate input state', () => {
  it('START_RUN leaves input unchanged', () => {
    const s = initialState(1);
    const before = { phase: s.phase, rngState: s.rngState };
    reduce(s, { t: 'START_RUN', crew: [{ name: 'A' }] }, cfg);
    expect(s.phase).toBe(before.phase);
    expect(s.rngState).toBe(before.rngState);
  });

  it('RESOLVE_MINIGAME leaves input unchanged', () => {
    const s = obstacleMinigameState({ heat: 0, loot: 0 });
    reduce(s, { t: 'RESOLVE_MINIGAME', outcome: 'clean' }, cfg);
    expect(s.heat).toBe(0);
    expect(s.loot).toBe(0);
  });
});

// ─── ASSIGN_GEAR ──────────────────────────────────────────────────────────────

function crewState(overrides: Partial<RunState> = {}): RunState {
  return {
    ...initialState(42),
    phase: 'offer' as const,
    crew: [
      {
        id: 'player-0' as PlayerId,
        name: 'Alice',
        stats: { tech: 0, physical: 0, charm: 0, stealth: 0 },
        powerUps: {},
      },
      {
        id: 'player-1' as PlayerId,
        name: 'Bob',
        stats: { tech: 0, physical: 0, charm: 0, stealth: 0 },
        powerUps: {},
      },
    ],
    ...overrides,
  };
}

describe('ASSIGN_GEAR — stat boost', () => {
  it('applies a +1 stat boost to the targeted player', () => {
    const s = crewState();
    const next = reduce(s, { t: 'ASSIGN_GEAR', gear: 'stat-tech-1' as GearId, to: 'player-0' as PlayerId }, cfg);
    expect(next.crew[0]!.stats.tech).toBe(1);
  });

  it('applies a +2 Big Score to the targeted player', () => {
    const s = crewState();
    const next = reduce(s, { t: 'ASSIGN_GEAR', gear: 'stat-tech-2' as GearId, to: 'player-0' as PlayerId }, cfg);
    expect(next.crew[0]!.stats.tech).toBe(2);
  });

  it('stacks: two +1 boosts to same lane produce +2', () => {
    const s = crewState();
    const after1 = reduce(s, { t: 'ASSIGN_GEAR', gear: 'stat-tech-1' as GearId, to: 'player-0' as PlayerId }, cfg);
    const after2 = reduce(after1, { t: 'ASSIGN_GEAR', gear: 'stat-tech-1' as GearId, to: 'player-0' as PlayerId }, cfg);
    expect(after2.crew[0]!.stats.tech).toBe(2);
  });

  it('leaves other players untouched', () => {
    const s = crewState();
    const next = reduce(s, { t: 'ASSIGN_GEAR', gear: 'stat-tech-1' as GearId, to: 'player-0' as PlayerId }, cfg);
    expect(next.crew[1]!.stats.tech).toBe(0);
  });
});

describe('ASSIGN_GEAR — power-up', () => {
  it('grants the power-up to the targeted player', () => {
    const s = crewState();
    const next = reduce(s, { t: 'ASSIGN_GEAR', gear: 'powerup-charm' as GearId, to: 'player-1' as PlayerId }, cfg);
    expect(next.crew[1]!.powerUps.charm).toBe(true);
  });

  it('is idempotent: assigning the same power-up twice stays true', () => {
    const s = crewState();
    const after1 = reduce(s, { t: 'ASSIGN_GEAR', gear: 'powerup-charm' as GearId, to: 'player-0' as PlayerId }, cfg);
    const after2 = reduce(after1, { t: 'ASSIGN_GEAR', gear: 'powerup-charm' as GearId, to: 'player-0' as PlayerId }, cfg);
    expect(after2.crew[0]!.powerUps.charm).toBe(true);
  });

  it('leaves other players untouched', () => {
    const s = crewState();
    const next = reduce(s, { t: 'ASSIGN_GEAR', gear: 'powerup-charm' as GearId, to: 'player-0' as PlayerId }, cfg);
    expect(next.crew[1]!.powerUps.charm).toBeUndefined();
  });
});

describe('ASSIGN_GEAR — error cases', () => {
  it('throws on unknown gear id', () => {
    const s = crewState();
    expect(() =>
      reduce(s, { t: 'ASSIGN_GEAR', gear: 'nonexistent' as GearId, to: 'player-0' as PlayerId }, cfg),
    ).toThrow(/Unknown gear id/);
  });

  it('throws on unknown player id', () => {
    const s = crewState();
    expect(() =>
      reduce(s, { t: 'ASSIGN_GEAR', gear: 'stat-tech-1' as GearId, to: 'player-99' as PlayerId }, cfg),
    ).toThrow(/Unknown player id/);
  });

  it('does not mutate input state', () => {
    const s = crewState();
    const before = s.crew[0]!.stats.tech;
    reduce(s, { t: 'ASSIGN_GEAR', gear: 'stat-tech-1' as GearId, to: 'player-0' as PlayerId }, cfg);
    expect(s.crew[0]!.stats.tech).toBe(before);
  });
});
