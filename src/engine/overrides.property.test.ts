// Epic E2 acceptance gate: no-dead-end + undo-restores-prior-state property test.
//
// Generates reachable RunState's by replaying deterministic event sequences from
// multiple seeds, then asserts:
//   (a) For every tracked field (heat, loot, stats[lane], powerUps[lane],
//       restingUntilRoom, phase) there exists an override event that drives it
//       to an arbitrary legal value — no dead-ends.
//   (b) For every override applied via reduceSession, a following UNDO_LAST
//       restores the exact prior present (deep-equal).
import { describe, it, expect } from 'vitest';
import { reduceSession, initialSession } from '@/engine/history';
import { reduce } from '@/engine/reduce';
import { initialState } from '@/engine/run';
import type { EngineConfig } from '@/engine/config';
import type { Lane, PlayerId, RunPhase, RunState } from '@/engine/types';

// ─── Shared test config ───────────────────────────────────────────────────────
// Includes all headcounts and enough room templates for generateRoom to work.

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

// ─── State generator ──────────────────────────────────────────────────────────

/**
 * Build a reachable RunState by replaying a deterministic event sequence.
 * START_RUN with the given seed and crew size, leaving state in 'room' phase.
 */
function buildState(seed: number, crewSize: number): RunState {
  const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace'];
  const crew = names.slice(0, Math.min(crewSize, 7)).map(name => ({ name }));
  return reduce(initialState(seed), { t: 'START_RUN', crew, seed }, cfg);
}

// ─── Domain constants ─────────────────────────────────────────────────────────

const LANES: Lane[] = ['tech', 'physical', 'charm', 'stealth'];
const PHASES: RunPhase[] = ['briefing', 'room', 'minigame', 'offer', 'getaway', 'result'];

// Seeds × crew sizes → matrix of reachable states
const SEEDS = [1, 42, 1312, 7777, 99999];
const CREW_SIZES = [2, 3, 4, 5, 7];

// ─── Property: no dead-ends ───────────────────────────────────────────────────

describe('no-dead-end: every tracked field can be driven to any legal value', () => {
  it('heat can be set to 0, mid-range, and hMax from any state', () => {
    for (const seed of SEEDS) {
      for (const crewSize of CREW_SIZES) {
        const state = buildState(seed, crewSize);
        for (const target of [0, 7, cfg.heat.hMax]) {
          const session = initialSession(state);
          const after = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: target }, cfg);
          expect(after.present.heat).toBe(target);
        }
      }
    }
  });

  it('loot can be set to 0 and an arbitrarily large value from any state', () => {
    for (const seed of SEEDS) {
      const state = buildState(seed, 3);
      for (const target of [0, 25, 100]) {
        const session = initialSession(state);
        const after = reduceSession(session, { t: 'OVERRIDE_SET_LOOT', value: target }, cfg);
        expect(after.present.loot).toBe(target);
      }
    }
  });

  it('phase can be jumped to any RunPhase from any state', () => {
    for (const seed of SEEDS) {
      const state = buildState(seed, 2);
      for (const phase of PHASES) {
        const session = initialSession(state);
        const after = reduceSession(session, { t: 'OVERRIDE_SET_PHASE', phase }, cfg);
        expect(after.present.phase).toBe(phase);
      }
    }
  });

  it('stats[lane] can be set to any value for every player in every state', () => {
    for (const seed of SEEDS) {
      const state = buildState(seed, 3);
      for (const player of state.crew) {
        for (const lane of LANES) {
          const session = initialSession(state);
          const after = reduceSession(
            session,
            { t: 'OVERRIDE_SET_STAT', player: player.id, lane, value: 5 },
            cfg,
          );
          expect(after.present.crew.find(p => p.id === player.id)!.stats[lane]).toBe(5);
        }
      }
    }
  });

  it('powerUps[lane] can be granted (true) for every player × lane', () => {
    for (const seed of SEEDS) {
      const state = buildState(seed, 2);
      for (const player of state.crew) {
        for (const lane of LANES) {
          const session = initialSession(state);
          const after = reduceSession(
            session,
            { t: 'OVERRIDE_SET_POWERUP', player: player.id, lane, held: true },
            cfg,
          );
          expect(after.present.crew.find(p => p.id === player.id)!.powerUps[lane]).toBe(true);
        }
      }
    }
  });

  it('powerUps[lane] can be removed (false) for every player × lane', () => {
    // Start from a state where all power-ups are held so removal is non-trivial.
    for (const seed of SEEDS) {
      let state = buildState(seed, 2);
      // Grant all power-ups first
      for (const player of state.crew) {
        for (const lane of LANES) {
          state = reduce(state, { t: 'OVERRIDE_SET_POWERUP', player: player.id as PlayerId, lane, held: true }, cfg);
        }
      }
      for (const player of state.crew) {
        for (const lane of LANES) {
          const session = initialSession(state);
          const after = reduceSession(
            session,
            { t: 'OVERRIDE_SET_POWERUP', player: player.id, lane, held: false },
            cfg,
          );
          expect(after.present.crew.find(p => p.id === player.id)!.powerUps[lane]).toBeUndefined();
        }
      }
    }
  });

  it('restingUntilRoom can be set and cleared for every player', () => {
    for (const seed of SEEDS) {
      const state = buildState(seed, 3);
      for (const player of state.crew) {
        // Set restingUntilRoom
        const session = initialSession(state);
        const after = reduceSession(
          session,
          { t: 'OVERRIDE_SET_RESTING', player: player.id, untilRoom: 5 },
          cfg,
        );
        expect(after.present.crew.find(p => p.id === player.id)!.restingUntilRoom).toBe(5);

        // Clear restingUntilRoom (omit untilRoom)
        const cleared = reduceSession(
          after,
          { t: 'OVERRIDE_SET_RESTING', player: player.id },
          cfg,
        );
        expect(cleared.present.crew.find(p => p.id === player.id)!.restingUntilRoom).toBeUndefined();
      }
    }
  });
});

// ─── Property: undo restores prior present ────────────────────────────────────

describe('undo-restores-prior-state: UNDO_LAST after any override deep-equals the prior present', () => {
  /** Assert: override → undo → present === prior present. */
  function assertUndoRestores(state: RunState): void {
    const overrides = [
      { t: 'OVERRIDE_SET_HEAT' as const, value: (state.heat + 7) % (cfg.heat.hMax + 1) },
      { t: 'OVERRIDE_ADJUST_HEAT' as const, delta: 2 },
      { t: 'OVERRIDE_SET_LOOT' as const, value: state.loot + 10 },
      { t: 'OVERRIDE_ADJUST_LOOT' as const, delta: 3 },
      { t: 'OVERRIDE_SET_PHASE' as const, phase: 'offer' as const },
      { t: 'OVERRIDE_REROLL_ROOM' as const },
      { t: 'OVERRIDE_SKIP_ROOM' as const },
    ];

    for (const event of overrides) {
      const session = initialSession(state);
      const after = reduceSession(session, event, cfg);
      const undone = reduceSession(after, { t: 'UNDO_LAST' }, cfg);
      expect(undone.present).toEqual(state);
      expect(undone.past).toHaveLength(0);
    }

    // Player-specific overrides
    for (const player of state.crew) {
      const playerOverrides = [
        { t: 'OVERRIDE_SET_STAT' as const, player: player.id, lane: 'tech' as Lane, value: 3 },
        { t: 'OVERRIDE_ADJUST_STAT' as const, player: player.id, lane: 'physical' as Lane, delta: 1 },
        { t: 'OVERRIDE_SET_POWERUP' as const, player: player.id, lane: 'charm' as Lane, held: true },
        { t: 'OVERRIDE_SET_RESTING' as const, player: player.id, untilRoom: 4 },
        { t: 'OVERRIDE_SET_RESTING' as const, player: player.id },
      ];
      for (const event of playerOverrides) {
        const session = initialSession(state);
        const after = reduceSession(session, event, cfg);
        const undone = reduceSession(after, { t: 'UNDO_LAST' }, cfg);
        expect(undone.present).toEqual(state);
        expect(undone.past).toHaveLength(0);
      }
    }
  }

  for (const seed of SEEDS) {
    for (const crewSize of [2, 3, 5]) {
      it(`seed=${seed}, crew=${crewSize}: every override undoes cleanly`, () => {
        assertUndoRestores(buildState(seed, crewSize));
      });
    }
  }
});

// ─── Property: UNDO_LAST at root is a safe no-op ─────────────────────────────

describe('UNDO_LAST at root is a safe no-op (never a dead-end)', () => {
  it('single undo on fresh session leaves state unchanged', () => {
    for (const seed of SEEDS) {
      const state = buildState(seed, 2);
      const session = initialSession(state);
      const result = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
      expect(result.present).toEqual(state);
      expect(result.past).toHaveLength(0);
    }
  });

  it('multiple undos on fresh session are all no-ops', () => {
    const state = buildState(42, 3);
    let session = initialSession(state);
    for (let i = 0; i < 5; i++) {
      session = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    }
    expect(session.present).toEqual(state);
    expect(session.past).toHaveLength(0);
  });

  it('undo past root after a real event never throws or corrupts state', () => {
    const state = buildState(1312, 4);
    let session = initialSession(state);
    session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 3 }, cfg);
    // Undo the event (should restore original state)
    session = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(session.present).toEqual(state);
    // Undo again at root — safe no-op
    session = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
    expect(session.present).toEqual(state);
    expect(session.past).toHaveLength(0);
  });
});

// ─── Property: event sequence replay is deterministic ────────────────────────

describe('reduceSession is deterministic (same inputs ⇒ same output)', () => {
  it('same seed + same events produce identical session state', () => {
    function runSequence(): ReturnType<typeof reduceSession> {
      const state = buildState(1312, 3);
      let session = initialSession(state);
      session = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: 10 }, cfg);
      session = reduceSession(session, { t: 'OVERRIDE_SET_LOOT', value: 5 }, cfg);
      session = reduceSession(session, { t: 'OVERRIDE_REROLL_ROOM' }, cfg);
      session = reduceSession(session, { t: 'UNDO_LAST' }, cfg);
      return session;
    }
    expect(runSequence()).toEqual(runSequence());
  });
});
