import { describe, it, expect } from 'vitest';
import { reduceSession, initialSession } from '@/engine/history';
import { reduce } from '@/engine/reduce';
import { initialState } from '@/engine/run';
import type { EngineConfig } from '@/engine/config';
import type { RunState, PlayerId } from '@/engine/types';

// ─── Inline test config ───────────────────────────────────────────────────────

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
      '3': { getawayBonus: -0.02, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '4': { getawayBonus: 0.0,   crewPerOption: [1, 2] as [number, number], exhaustion: 'light' as const },
      '5': { getawayBonus: 0.02,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '6': { getawayBonus: 0.035, crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '7': { getawayBonus: 0.06,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
    },
    exhaustionRest: { full: 1, light: 1, tired: 0 },
    minCommit: { alpha: 1, bravo: 1 },
    variant: {},
    excludedFromSolo: [],
    soloEligibleMinPool: 8,
    dialCurve: { _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 } },
  },
  generation: { obstacleRatio: 0.8 },
  gear: {},
  roomTemplates: {
    obstacles: [
      {
        id: 'obs-a',
        gameId: 'alpha',
        lane: 'tech',
        options: [
          { id: 'a-safe',   greedy: false, heatCost: 1, reward: 1 },
          { id: 'a-greedy', greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
      {
        id: 'obs-b',
        gameId: 'bravo',
        lane: 'physical',
        options: [
          { id: 'b-safe',   greedy: false, heatCost: 1, reward: 1 },
          { id: 'b-greedy', greedy: true,  heatCost: 2, reward: 2 },
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
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** State with one player to drive override tests. */
function baseState(): RunState {
  return {
    ...initialState(1),
    phase: 'room' as const,
    heat: 5,
    loot: 3,
    crew: [
      {
        id: 'p0' as PlayerId,
        name: 'Alice',
        stats: { tech: 1, physical: 0, charm: 0, stealth: 0 },
        powerUps: {},
      },
    ],
  };
}

// ─── initialSession ───────────────────────────────────────────────────────────

describe('initialSession', () => {
  it('sets present to the supplied state', () => {
    const s = baseState();
    const session = initialSession(s);
    expect(session.present).toEqual(s);
  });

  it('starts with an empty past stack', () => {
    const session = initialSession(baseState());
    expect(session.past).toHaveLength(0);
  });

  it('does not mutate the input state', () => {
    const s = baseState();
    const originalHeat = s.heat;
    initialSession(s);
    expect(s.heat).toBe(originalHeat);
  });
});

// ─── reduceSession — non-UNDO events ─────────────────────────────────────────

describe('reduceSession non-UNDO events', () => {
  it('updates present via reduce', () => {
    const session = initialSession(baseState());
    const next = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 12 }, cfg);
    expect(next.present.heat).toBe(12);
  });

  it('pushes prior present onto past', () => {
    const s = baseState();
    const session = initialSession(s);
    const next = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 12 }, cfg);
    expect(next.past).toHaveLength(1);
    expect(next.past[0]).toEqual(s);
  });

  it('accumulates past on repeated events', () => {
    const s = baseState();
    let session = initialSession(s);
    session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 10 }, cfg);
    session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 15 }, cfg);
    expect(session.past).toHaveLength(2);
    expect(session.present.heat).toBe(15);
    // past[0] is the state before the last event (heat=10)
    expect(session.past[0]!.heat).toBe(10);
    // past[1] is the original (heat=5)
    expect(session.past[1]!.heat).toBe(5);
  });

  it('does not mutate the input session', () => {
    const s = baseState();
    const session = initialSession(s);
    const pastLengthBefore = session.past.length;
    reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 10 }, cfg);
    expect(session.past).toHaveLength(pastLengthBefore);
    expect(session.present.heat).toBe(s.heat);
  });
});

// ─── reduceSession — UNDO_LAST ────────────────────────────────────────────────

describe('reduceSession UNDO_LAST', () => {
  it('restores prior present on undo', () => {
    const s = baseState();
    const session = initialSession(s);
    const after = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 12 }, cfg);
    const undone = reduceSession(after, { t: 'UNDO_LAST' }, cfg);
    expect(undone.present).toEqual(s);
  });

  it('shrinks past by one on undo', () => {
    const s = baseState();
    let session = initialSession(s);
    session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 10 }, cfg);
    session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 15 }, cfg);
    expect(session.past).toHaveLength(2);
    const undone = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(undone.past).toHaveLength(1);
  });

  it('restores states in LIFO order across multiple undos', () => {
    const s = baseState();
    let session = initialSession(s);
    // Apply three overrides in sequence
    session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 10 }, cfg);
    session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 15 }, cfg);
    session = reduceSession(session, { t: 'OVERRIDE_SET_LOOT', value: 99 }, cfg);
    // Undo three times and expect states to peel back
    session = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(session.present.heat).toBe(15);
    expect(session.present.loot).toBe(3); // original loot
    session = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(session.present.heat).toBe(10);
    session = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(session.present).toEqual(s);
    expect(session.past).toHaveLength(0);
  });

  it('is a safe no-op at the root (empty past)', () => {
    const s = baseState();
    const session = initialSession(s);
    // UNDO_LAST on a fresh session should return the same session without throwing
    const result = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(result.present).toEqual(s);
    expect(result.past).toHaveLength(0);
  });

  it('multiple UNDOs at root are all safe no-ops', () => {
    const s = baseState();
    let session = initialSession(s);
    // Apply one event, undo it, then undo again at root
    session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 8 }, cfg);
    session = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(session.past).toHaveLength(0);
    // Second undo at root — should be silent no-op
    const result = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(result.present).toEqual(s);
    expect(result.past).toHaveLength(0);
  });

  it('does not mutate the session on UNDO_LAST', () => {
    const s = baseState();
    let session = initialSession(s);
    session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 10 }, cfg);
    const presentBefore = session.present;
    const pastLengthBefore = session.past.length;
    reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(session.present).toBe(presentBefore);
    expect(session.past).toHaveLength(pastLengthBefore);
  });
});

// ─── reduceSession — works via reduce for all RunEvents ──────────────────────

describe('reduceSession dispatches RunEvents through reduce', () => {
  it('OVERRIDE_SET_LOOT updates loot and records past', () => {
    const s = baseState();
    const session = initialSession(s);
    const next = reduceSession(session, { t: 'OVERRIDE_SET_LOOT', value: 42 }, cfg);
    expect(next.present.loot).toBe(42);
    expect(next.past[0]!.loot).toBe(s.loot);
  });

  it('OVERRIDE_SET_STAT updates the player stat and records past', () => {
    const s = baseState();
    const session = initialSession(s);
    const next = reduceSession(
      session,
      { t: 'OVERRIDE_SET_STAT', player: 'p0' as PlayerId, lane: 'tech', value: 7 },
      cfg,
    );
    expect(next.present.crew[0]!.stats.tech).toBe(7);
    const undone = reduceSession(next, { t: 'UNDO_LAST' }, cfg);
    expect(undone.present.crew[0]!.stats.tech).toBe(s.crew[0]!.stats.tech);
  });

  it('OVERRIDE_SET_PHASE updates phase and undo restores it', () => {
    const s = baseState();
    const session = initialSession(s);
    const next = reduceSession(session, { t: 'OVERRIDE_SET_PHASE', phase: 'getaway' }, cfg);
    expect(next.present.phase).toBe('getaway');
    const undone = reduceSession(next, { t: 'UNDO_LAST' }, cfg);
    expect(undone.present.phase).toBe(s.phase);
  });

  it('result of reduce and reduceSession present match for the same non-UNDO event', () => {
    const s = baseState();
    const event = { t: 'OVERRIDE_SET_HEAT' as const, value: 9 };
    const fromReduce = reduce(s, event, cfg);
    const fromSession = reduceSession(initialSession(s), event, cfg);
    expect(fromSession.present).toEqual(fromReduce);
  });
});
