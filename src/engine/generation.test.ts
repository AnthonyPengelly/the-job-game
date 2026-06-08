import { describe, it, expect } from 'vitest';
import { generateRoom, tickCarriedEffects } from '@/engine/generation';
import { initialState } from '@/engine/run';
import type { EngineConfig } from '@/engine/config';
import type { RunState, CarriedEffect, PlayerId } from '@/engine/types';

// ─── Inline test config — no platform dependency ─────────────────────────────
// Mirror of tuning numbers; roomTemplates has enough entries for no-repeat tests.

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
    profiles: { '4': { getawayBonus: 0.0, crewPerOption: [1, 2] as [number, number], exhaustion: 'light' as const } },
    exhaustionRest: { full: 1, light: 1, tired: 0 },
    minCommit: { alpha: 1, bravo: 1, charlie: 1, delta: 2 },
    variant: {},
    excludedFromSolo: [],
    soloEligibleMinPool: 8,
    dialCurve: { _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 } },
  },
  generation: { obstacleRatio: 0.6 },
  scenario: { dcClamp: [1, 20] as [number, number], easeDialSteps: 1, critFumble: false },
  gearSellValue: { base: 1000, perRoom: 500 },
  gear: {},
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
      {
        id: 'obs-delta',
        gameId: 'delta',
        lane: 'charm',
        options: [
          { id: 'delta-safe',   greedy: false, heatCost: 1, reward: 1 },
          { id: 'delta-greedy', greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
    ],
    scenarios: [
      {
        id: 'scen-1',
        setup: 'A clerk offers to help.',
        choices: [
          { id: 's1-a', label: 'Choice A', effect: { heatDelta: -2, lootDelta: 0 } },
          { id: 's1-b', label: 'Choice B', effect: { heatDelta:  0, lootDelta: 1 } },
        ],
      },
      {
        id: 'scen-2',
        setup: 'A van idles in the alley.',
        choices: [
          { id: 's2-a', label: 'Option A', effect: { heatDelta:  2, lootDelta: 0 } },
          { id: 's2-b', label: 'Option B', effect: { heatDelta: -4, lootDelta: 0 } },
        ],
      },
      {
        id: 'scen-3',
        setup: 'Something stashed beneath the floorboard.',
        choices: [
          { id: 's3-a', label: 'Take it',  effect: { heatDelta: 0,  lootDelta: 2 } },
          { id: 's3-b', label: 'Leave it', effect: { heatDelta: -2, lootDelta: 0 } },
        ],
      },
    ],
  },
};

function makeState(seed: number, overrides: Partial<RunState> = {}): RunState {
  return { ...initialState(seed), ...overrides };
}

// ─── tickCarriedEffects ──────────────────────────────────────────────────────

describe('tickCarriedEffects', () => {
  it('decrements roomsLeft by 1 on each tick', () => {
    const effects: CarriedEffect[] = [
      { id: 'e1', kind: 'briefcase', roomsLeft: 3 },
    ];
    const { remaining } = tickCarriedEffects(effects);
    expect(remaining[0]?.roomsLeft).toBe(2);
  });

  it('removes effects when roomsLeft reaches 0 after tick', () => {
    const effects: CarriedEffect[] = [
      { id: 'expiring', kind: 'briefcase', roomsLeft: 1 },
    ];
    const { remaining } = tickCarriedEffects(effects);
    expect(remaining).toHaveLength(0);
  });

  it('removes effects already at roomsLeft <= 0', () => {
    const effects: CarriedEffect[] = [
      { id: 'already-expired', kind: 'briefcase', roomsLeft: 0 },
    ];
    const { remaining } = tickCarriedEffects(effects);
    expect(remaining).toHaveLength(0);
  });

  it('removes expired and keeps surviving; decrements survivor', () => {
    const effects: CarriedEffect[] = [
      { id: 'a', kind: 'x', roomsLeft: 2 },
      { id: 'b', kind: 'y', roomsLeft: 1 },
    ];
    const { remaining } = tickCarriedEffects(effects);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe('a');
    expect(remaining[0]!.roomsLeft).toBe(1);
  });

  it('fires payoff from an expiring effect with payoff set', () => {
    const effects: CarriedEffect[] = [
      { id: 'briefcase', kind: 'briefcase', roomsLeft: 1, payoff: { heatDelta: 0, lootDelta: 1 } },
    ];
    const { remaining, firedPayoffs } = tickCarriedEffects(effects);
    expect(remaining).toHaveLength(0);
    expect(firedPayoffs).toHaveLength(1);
    expect(firedPayoffs[0]?.lootDelta).toBe(1);
  });

  it('no payoff fired for effects that expire without a payoff', () => {
    const effects: CarriedEffect[] = [
      { id: 'ease', kind: 'easeNextObstacle', roomsLeft: 1 },
    ];
    const { firedPayoffs } = tickCarriedEffects(effects);
    expect(firedPayoffs).toHaveLength(0);
  });

  it('fires perRoomEffect on a surviving tick', () => {
    const effects: CarriedEffect[] = [
      { id: 'bc', kind: 'briefcase', roomsLeft: 2, perRoomEffect: { heatDelta: 2, lootDelta: 0 } },
    ];
    const { remaining, perRoomEffects } = tickCarriedEffects(effects);
    expect(remaining).toHaveLength(1);
    expect(perRoomEffects).toHaveLength(1);
    expect(perRoomEffects[0]?.heatDelta).toBe(2);
  });

  it('fires perRoomEffect on the expiry tick alongside payoff', () => {
    const effects: CarriedEffect[] = [
      {
        id: 'bc',
        kind: 'briefcase',
        roomsLeft: 1,
        perRoomEffect: { heatDelta: 2, lootDelta: 0 },
        payoff: { heatDelta: 0, lootDelta: 2 },
      },
    ];
    const { remaining, perRoomEffects, firedPayoffs } = tickCarriedEffects(effects);
    expect(remaining).toHaveLength(0);
    expect(perRoomEffects).toHaveLength(1);
    expect(perRoomEffects[0]?.heatDelta).toBe(2);
    expect(firedPayoffs).toHaveLength(1);
    expect(firedPayoffs[0]?.lootDelta).toBe(2);
  });

  it('returns empty perRoomEffects for effects without perRoomEffect', () => {
    const effects: CarriedEffect[] = [
      { id: 'ease', kind: 'easeNextObstacle', roomsLeft: 1 },
    ];
    const { perRoomEffects } = tickCarriedEffects(effects);
    expect(perRoomEffects).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    const { remaining, firedPayoffs, perRoomEffects } = tickCarriedEffects([]);
    expect(remaining).toEqual([]);
    expect(firedPayoffs).toEqual([]);
    expect(perRoomEffects).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const effects: CarriedEffect[] = [{ id: 'x', kind: 'k', roomsLeft: 5 }];
    tickCarriedEffects(effects);
    expect(effects[0]!.roomsLeft).toBe(5);
  });
});

// ─── generateRoom — determinism ───────────────────────────────────────────────

describe('generateRoom — determinism', () => {
  it('returns the same room for the same seed', () => {
    const s1 = makeState(1312);
    const s2 = makeState(1312);
    expect(generateRoom(s1, cfg).currentRoom).toEqual(generateRoom(s2, cfg).currentRoom);
  });

  it('same seed yields same rngState afterward', () => {
    const s1 = makeState(1312);
    const s2 = makeState(1312);
    expect(generateRoom(s1, cfg).rngState).toBe(generateRoom(s2, cfg).rngState);
  });

  it('different seeds (usually) yield different rooms', () => {
    // Pick seeds we know diverge based on the fixed RNG stream.
    const ids = [1312, 9999, 42, 777, 2024, 314].map(seed =>
      generateRoom(makeState(seed), cfg).currentRoom?.templateId,
    );
    const allSame = ids.every(id => id === ids[0]);
    expect(allSame).toBe(false);
  });

  it('does not mutate the input state', () => {
    const s = makeState(1312);
    const original = { ...s };
    generateRoom(s, cfg);
    expect(s.rngState).toBe(original.rngState);
    expect(s.currentRoom).toBeNull();
  });

  it('sequential draws advance rngState each time', () => {
    const s = makeState(1312);
    const r1 = generateRoom(s, cfg);
    const r2 = generateRoom({ ...s, rngState: r1.rngState }, cfg);
    expect(r1.rngState).not.toBe(s.rngState);
    expect(r2.rngState).not.toBe(r1.rngState);
  });
});

// ─── generateRoom — room shapes ───────────────────────────────────────────────

describe('generateRoom — obstacle room shape', () => {
  // Find a seed that yields an obstacle room with the inline cfg.
  function findObstacleRoom(): ReturnType<typeof generateRoom> {
    for (let seed = 0; seed < 50; seed++) {
      const result = generateRoom(makeState(seed), cfg);
      if (result.currentRoom?.kind === 'obstacle') return result;
    }
    throw new Error('No obstacle room found in 50 seeds');
  }

  it('obstacle rooms have exactly two options', () => {
    const { currentRoom } = findObstacleRoom();
    expect(currentRoom?.kind).toBe('obstacle');
    if (currentRoom?.kind === 'obstacle') {
      expect(currentRoom.options).toHaveLength(2);
    }
  });

  it('options are [safe, greedy] — first greedy:false, second greedy:true', () => {
    const { currentRoom } = findObstacleRoom();
    if (currentRoom?.kind === 'obstacle') {
      expect(currentRoom.options[0]!.greedy).toBe(false);
      expect(currentRoom.options[1]!.greedy).toBe(true);
    }
  });

  it('safe and greedy rewards match the template config (safe ≤ greedy)', () => {
    const { currentRoom } = findObstacleRoom();
    if (currentRoom?.kind === 'obstacle') {
      const template = cfg.roomTemplates.obstacles.find(t => t.id === currentRoom.templateId)!;
      expect(currentRoom.options[0]!.reward).toBe(template.options[0]!.reward);
      expect(currentRoom.options[1]!.reward).toBe(template.options[1]!.reward);
      expect(currentRoom.options[0]!.reward).toBeLessThanOrEqual(currentRoom.options[1]!.reward);
    }
  });

  it('obstacle room has a templateId from the obstacle pool', () => {
    const { currentRoom } = findObstacleRoom();
    const knownIds = cfg.roomTemplates.obstacles.map(t => t.id);
    expect(knownIds).toContain(currentRoom?.templateId);
  });
});

describe('generateRoom — scenario room shape', () => {
  function findScenarioRoom(): ReturnType<typeof generateRoom> {
    for (let seed = 0; seed < 50; seed++) {
      const result = generateRoom(makeState(seed), cfg);
      if (result.currentRoom?.kind === 'scenario') return result;
    }
    throw new Error('No scenario room found in 50 seeds');
  }

  it('scenario rooms have exactly two choices', () => {
    const { currentRoom } = findScenarioRoom();
    if (currentRoom?.kind === 'scenario') {
      expect(currentRoom.choices).toHaveLength(2);
    }
  });

  it('scenario choices have non-empty labels', () => {
    const { currentRoom } = findScenarioRoom();
    if (currentRoom?.kind === 'scenario') {
      expect(currentRoom.choices[0]!.label.length).toBeGreaterThan(0);
      expect(currentRoom.choices[1]!.label.length).toBeGreaterThan(0);
    }
  });

  it('scenario choices carry isRoll flag from the ScenarioDef', () => {
    const { currentRoom } = findScenarioRoom();
    if (currentRoom?.kind === 'scenario') {
      for (const choice of currentRoom.choices) {
        expect(typeof choice.isRoll).toBe('boolean');
      }
    }
  });

  it('scenario room carries a non-empty setup string', () => {
    const { currentRoom } = findScenarioRoom();
    if (currentRoom?.kind === 'scenario') {
      expect(currentRoom.setup.length).toBeGreaterThan(0);
    }
  });

  it('scenario room has a templateId from the scenario pool', () => {
    const { currentRoom } = findScenarioRoom();
    const knownIds = cfg.roomTemplates.scenarios.map(t => t.id);
    expect(knownIds).toContain(currentRoom?.templateId);
  });
});

// ─── generateRoom — no-repeat draw ───────────────────────────────────────────

describe('generateRoom — no-repeat until pool exhausted', () => {
  it('obstacle draws never repeat a templateId until all are used', () => {
    const totalObstacles = cfg.roomTemplates.obstacles.length; // 4
    expect(totalObstacles).toBeGreaterThanOrEqual(3);

    // Exhaust the obstacle pool by simulating many draws.
    const seen: string[] = [];
    let state = makeState(42);

    for (let i = 0; i < totalObstacles * 30 && seen.length < totalObstacles; i++) {
      const next = generateRoom(state, cfg);
      state = { ...state, ...next, roomIndex: state.roomIndex + 1 };
      if (next.currentRoom?.kind === 'obstacle') {
        const tid = next.currentRoom.templateId;
        expect(seen).not.toContain(tid);
        seen.push(tid);
      }
    }

    expect(seen.length).toBe(totalObstacles);
  });

  it('scenario draws never repeat a templateId until all are used', () => {
    const totalScenarios = cfg.roomTemplates.scenarios.length; // 3
    expect(totalScenarios).toBeGreaterThanOrEqual(3);

    const seen: string[] = [];
    let state = makeState(99);

    for (let i = 0; i < totalScenarios * 30 && seen.length < totalScenarios; i++) {
      const next = generateRoom(state, cfg);
      state = { ...state, ...next, roomIndex: state.roomIndex + 1 };
      if (next.currentRoom?.kind === 'scenario') {
        const tid = next.currentRoom.templateId;
        expect(seen).not.toContain(tid);
        seen.push(tid);
      }
    }

    expect(seen.length).toBe(totalScenarios);
  });

  it('pool resets after exhaustion — the next draw succeeds and starts a fresh used list', () => {
    const allIds = cfg.roomTemplates.obstacles.map(t => t.id);
    // Pre-fill usedObstacleTemplateIds with all obstacle IDs to simulate exhaustion.
    const exhaustedState = makeState(7, { usedObstacleTemplateIds: [...allIds] });

    let state = exhaustedState;
    for (let i = 0; i < 30; i++) {
      const next = generateRoom(state, cfg);
      state = { ...state, ...next, roomIndex: state.roomIndex + 1 };
      if (next.currentRoom?.kind === 'obstacle') {
        // After reset the used list should contain exactly this one ID.
        expect(state.usedObstacleTemplateIds).toHaveLength(1);
        expect(allIds).toContain(state.usedObstacleTemplateIds[0]);
        return;
      }
    }
    throw new Error('No obstacle room drawn after pool exhaustion reset test');
  });
});

// ─── generateRoom — carried effects ticking ──────────────────────────────────

describe('generateRoom — carried effects', () => {
  it('ticks carried effects when generating a room', () => {
    const effects: CarriedEffect[] = [
      { id: 'e1', kind: 'briefcase', roomsLeft: 3 },
      { id: 'e2', kind: 'unlock',    roomsLeft: 1 },
    ];
    const state = makeState(1312, { carried: effects });
    const result = generateRoom(state, cfg);

    expect(result.carried.find(e => e.id === 'e2')).toBeUndefined();
    expect(result.carried.find(e => e.id === 'e1')?.roomsLeft).toBe(2);
  });

  it('expired effects do not appear in next state', () => {
    const state = makeState(42, {
      carried: [{ id: 'dying', kind: 'x', roomsLeft: 1 }],
    });
    expect(generateRoom(state, cfg).carried).toHaveLength(0);
  });

  it('carry effects with 3-room countdown fire on the correct tick', () => {
    const state = makeState(1, {
      carried: [{ id: 'timer', kind: 'countdown', roomsLeft: 3 }],
    });
    let s = state;
    for (let tick = 0; tick < 3; tick++) {
      const next = generateRoom(s, cfg);
      s = { ...s, ...next, roomIndex: s.roomIndex + 1 };
      if (tick < 2) {
        expect(s.carried.find(e => e.id === 'timer')).toBeDefined();
      }
    }
    // After 3 ticks the effect should be gone.
    expect(s.carried.find(e => e.id === 'timer')).toBeUndefined();
  });
});

// ─── generateRoom — commitRange annotation ────────────────────────────────────

// Full config with all headcount profiles and excludedFromSolo games for these tests.
const cfgFull: EngineConfig = {
  ...cfg,
  scaling: {
    ...cfg.scaling,
    profiles: {
      '2': { getawayBonus: -0.04, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '3': { getawayBonus: -0.02, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '4': { getawayBonus: 0.0,   crewPerOption: [1, 2] as [number, number], exhaustion: 'light' as const },
      '5': { getawayBonus: 0.02,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '6': { getawayBonus: 0.035, crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '7': { getawayBonus: 0.05,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
    },
    minCommit: { alpha: 1, bravo: 1, charlie: 1, delta: 2 },
    excludedFromSolo: ['delta'],
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
      {
        id: 'obs-delta',
        gameId: 'delta',
        lane: 'charm',
        options: [
          { id: 'delta-safe',   greedy: false, heatCost: 1, reward: 1 },
          { id: 'delta-greedy', greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
    ],
    scenarios: cfg.roomTemplates.scenarios,
  },
};

function makePlayerStub(idx: number) {
  return {
    id: `player-${idx}` as PlayerId,
    name: `Player${idx}`,
    stats: { tech: 0, physical: 0, charm: 0, stealth: 0 },
    powerUps: {},
  } as const;
}

function makeCrewState(n: number, seed: number): RunState {
  const crew = Array.from({ length: n }, (_, i) => makePlayerStub(i));
  return makeState(seed, { crew });
}

describe('generateRoom — commitRange annotation', () => {
  it('obstacle options have no commitRange when crew is empty (pre-run)', () => {
    // Find an obstacle room with empty crew — commitRange is not annotated.
    for (let seed = 0; seed < 50; seed++) {
      const result = generateRoom(makeState(seed), cfgFull);
      if (result.currentRoom?.kind === 'obstacle') {
        expect(result.currentRoom.options[0]?.commitRange).toBeUndefined();
        expect(result.currentRoom.options[1]?.commitRange).toBeUndefined();
        return;
      }
    }
    throw new Error('No obstacle room found');
  });

  it('obstacle options have commitRange when crew is set', () => {
    for (let seed = 0; seed < 50; seed++) {
      const result = generateRoom(makeCrewState(4, seed), cfgFull);
      if (result.currentRoom?.kind === 'obstacle') {
        expect(result.currentRoom.options[0]?.commitRange).toBeDefined();
        expect(result.currentRoom.options[1]?.commitRange).toBeDefined();
        return;
      }
    }
    throw new Error('No obstacle room found');
  });

  it('commitRange is feasible (1 ≤ minCrew ≤ maxCrew ≤ n) for all n=2..7', () => {
    for (let n = 2; n <= 7; n++) {
      // Sample several seeds to cover different obstacle templates.
      for (let seed = 0; seed < 30; seed++) {
        const result = generateRoom(makeCrewState(n, seed), cfgFull);
        if (result.currentRoom?.kind !== 'obstacle') continue;
        for (const opt of result.currentRoom.options) {
          if (opt.commitRange === undefined) continue;
          const [minCrew, maxCrew] = opt.commitRange;
          expect(minCrew).toBeGreaterThanOrEqual(1);
          expect(minCrew).toBeLessThanOrEqual(maxCrew);
          expect(maxCrew).toBeLessThanOrEqual(n);
        }
      }
    }
  });

  it('minCrew ≥ minCommit[game] in every generated commitRange', () => {
    for (let n = 2; n <= 7; n++) {
      for (let seed = 0; seed < 20; seed++) {
        const result = generateRoom(makeCrewState(n, seed), cfgFull);
        if (result.currentRoom?.kind !== 'obstacle') continue;
        const gameId = result.currentRoom.options[0]!.gameId as string;
        const gameMinCommit = cfgFull.scaling.minCommit[gameId] ?? 1;
        for (const opt of result.currentRoom.options) {
          if (opt.commitRange === undefined) continue;
          const [minCrew] = opt.commitRange;
          expect(minCrew).toBeGreaterThanOrEqual(gameMinCommit);
        }
      }
    }
  });

  it('excludedFromSolo games never have commitRange.minCrew === 1', () => {
    for (let n = 2; n <= 7; n++) {
      for (let seed = 0; seed < 50; seed++) {
        const result = generateRoom(makeCrewState(n, seed), cfgFull);
        if (result.currentRoom?.kind !== 'obstacle') continue;
        const gameId = result.currentRoom.options[0]!.gameId as string;
        if (!cfgFull.scaling.excludedFromSolo.includes(gameId)) continue;
        for (const opt of result.currentRoom.options) {
          if (opt.commitRange === undefined) continue;
          expect(opt.commitRange[0]).toBeGreaterThan(1);
        }
      }
    }
  });

  it('commitRange is the same for both options of the same obstacle (same gameId)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const result = generateRoom(makeCrewState(4, seed), cfgFull);
      if (result.currentRoom?.kind !== 'obstacle') continue;
      const opt0 = result.currentRoom.options[0]!;
      const opt1 = result.currentRoom.options[1]!;
      if (opt0.commitRange !== undefined && opt1.commitRange !== undefined) {
        expect(opt0.commitRange).toEqual(opt1.commitRange);
        return;
      }
    }
    throw new Error('No obstacle room with commitRange found');
  });

  it('commitRange annotation does not change rngState (pure metadata, no RNG draw)', () => {
    // State without crew (no commitRange) vs with crew (commitRange added).
    // The rngState after generation must be the same in both cases.
    for (let seed = 0; seed < 50; seed++) {
      const withoutCrew = generateRoom(makeState(seed), cfgFull);
      const withCrew    = generateRoom(makeCrewState(4, seed), cfgFull);
      if (withoutCrew.currentRoom?.kind !== 'obstacle') continue;
      expect(withCrew.rngState).toBe(withoutCrew.rngState);
      return;
    }
    throw new Error('No obstacle room found');
  });

  it('results are deterministic: same seed + same crew size ⇒ same commitRange', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r1 = generateRoom(makeCrewState(5, seed), cfgFull);
      const r2 = generateRoom(makeCrewState(5, seed), cfgFull);
      if (r1.currentRoom?.kind !== 'obstacle') continue;
      expect(r1.currentRoom).toEqual(r2.currentRoom);
      return;
    }
    throw new Error('No obstacle room found');
  });
});

// ─── generateRoom — easeNextObstacle annotation ──────────────────────────────

describe('generateRoom — easeNextObstacle annotation', () => {
  const easeEffect: CarriedEffect = { id: 'ease-1', kind: 'easeNextObstacle', roomsLeft: 1 };

  it('easeDialSteps is set on an obstacle room when an ease effect is active', () => {
    for (let seed = 0; seed < 50; seed++) {
      const result = generateRoom(makeState(seed, { carried: [easeEffect] }), cfg);
      if (result.currentRoom?.kind !== 'obstacle') continue;
      expect(result.currentRoom.easeDialSteps).toBe(cfg.scenario.easeDialSteps);
      expect(result.carried.find(e => e.kind === 'easeNextObstacle')).toBeUndefined();
      return;
    }
    throw new Error('No obstacle room found in 50 seeds');
  });

  it('ease effect persists through a scenario room without ticking', () => {
    for (let seed = 0; seed < 50; seed++) {
      const result = generateRoom(makeState(seed, { carried: [easeEffect] }), cfg);
      if (result.currentRoom?.kind !== 'scenario') continue;
      expect(result.carried.find(e => e.kind === 'easeNextObstacle')).toBeDefined();
      return;
    }
    throw new Error('No scenario room found in 50 seeds');
  });

  it('easeDialSteps reaches an obstacle room that follows an intervening scenario', () => {
    // Step 1: find a seed that generates a scenario room first.
    let afterScenario: RunState | undefined;
    for (let seed = 0; seed < 50; seed++) {
      const state = makeState(seed, { carried: [easeEffect] });
      const result = generateRoom(state, cfg);
      if (result.currentRoom?.kind !== 'scenario') continue;
      afterScenario = { ...state, ...result, roomIndex: 1 };
      break;
    }
    expect(afterScenario).toBeDefined();

    // Step 2: generate rooms until obstacle; it must carry easeDialSteps.
    let state = afterScenario!;
    for (let i = 0; i < 50; i++) {
      const next = generateRoom(state, cfg);
      state = { ...state, ...next, roomIndex: state.roomIndex + 1 };
      if (next.currentRoom?.kind !== 'obstacle') continue;
      expect(next.currentRoom.easeDialSteps).toBe(cfg.scenario.easeDialSteps);
      expect(next.carried.find(e => e.kind === 'easeNextObstacle')).toBeUndefined();
      return;
    }
    throw new Error('No obstacle room found after intervening scenario');
  });
});

// ─── generateRoom — gear-on-option propagation ────────────────────────────────

describe('generateRoom — gear propagated onto obstacle options', () => {
  const gearDescriptor = { kind: 'statBoost' as const, lane: 'tech' as const };

  const cfgWithGear: EngineConfig = {
    ...cfg,
    roomTemplates: {
      ...cfg.roomTemplates,
      obstacles: [
        {
          id: 'obs-with-gear',
          gameId: 'alpha',
          lane: 'tech',
          options: [
            { id: 'gear-safe',   greedy: false, heatCost: 1, reward: 1, gear: gearDescriptor },
            { id: 'gear-greedy', greedy: true,  heatCost: 2, reward: 2 },
          ],
        },
        {
          id: 'obs-no-gear',
          gameId: 'bravo',
          lane: 'physical',
          options: [
            { id: 'nogear-safe',   greedy: false, heatCost: 1, reward: 1 },
            { id: 'nogear-greedy', greedy: true,  heatCost: 2, reward: 2 },
          ],
        },
        ...cfg.roomTemplates.obstacles.slice(2),
      ],
    },
  };

  function findObstacleById(id: string): ReturnType<typeof generateRoom> {
    for (let seed = 0; seed < 200; seed++) {
      const result = generateRoom(makeState(seed), cfgWithGear);
      if (result.currentRoom?.kind === 'obstacle' && result.currentRoom.templateId === id) {
        return result;
      }
    }
    throw new Error(`No obstacle room with id "${id}" found in 200 seeds`);
  }

  it('gear from template option is carried onto the generated ObstacleOption', () => {
    const { currentRoom } = findObstacleById('obs-with-gear');
    if (currentRoom?.kind === 'obstacle') {
      expect(currentRoom.options[0]!.gear).toEqual(gearDescriptor);
    }
  });

  it('option without gear has no gear field on generated ObstacleOption', () => {
    const { currentRoom } = findObstacleById('obs-with-gear');
    if (currentRoom?.kind === 'obstacle') {
      expect(currentRoom.options[1]!.gear).toBeUndefined();
    }
  });

  it('gear does not affect rngState (pure metadata, no extra draw)', () => {
    const withGear = generateRoom(makeState(42), cfgWithGear);
    const withoutGear = generateRoom(makeState(42), cfg);
    // If the same seed draws the same room type (obstacle or scenario), rngState must match.
    if (withGear.currentRoom?.kind === withoutGear.currentRoom?.kind) {
      expect(withGear.rngState).toBe(withoutGear.rngState);
    }
  });

  it('template with no gear on either option yields no gear on generated options', () => {
    const { currentRoom } = findObstacleById('obs-no-gear');
    if (currentRoom?.kind === 'obstacle') {
      expect(currentRoom.options[0]!.gear).toBeUndefined();
      expect(currentRoom.options[1]!.gear).toBeUndefined();
    }
  });
});
