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
import { testCfg as cfg } from '@/engine/test-config';
import type { Lane, RunPhase, RunState } from '@/engine/types';

// ─── Domain constants ─────────────────────────────────────────────────────────

const LANES: Lane[] = ['tech', 'physical', 'charm', 'stealth'];
const PHASES: RunPhase[] = ['briefing', 'room', 'minigame', 'offer', 'getaway', 'result'];

// Seeds × crew sizes → matrix of reachable states
const SEEDS = [1, 42, 1312, 7777, 99999];
const CREW_SIZES = [2, 3, 4, 5, 7];

// ─── State generators ─────────────────────────────────────────────────────────

/** Build a reachable RunState by replaying START_RUN with the given seed and crew. */
function buildState(seed: number, crewSize: number): RunState {
  const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace'];
  const crew = names.slice(0, Math.min(crewSize, 7)).map(name => ({ name }));
  return reduce(initialState(seed), { t: 'START_RUN', crew, seed }, cfg);
}

/**
 * Advance one room from the current state by resolving whatever room is active
 * (obstacle → safe option + clean outcome; scenario → first choice), then PUSH_ON.
 * Returns the state unchanged if phase is not 'room' or there is no current room.
 */
function advanceOneRoom(state: RunState): RunState {
  if (state.phase !== 'room' || state.currentRoom === null) return state;
  const room = state.currentRoom;

  let inOffer: RunState;
  if (room.kind === 'obstacle') {
    // Commit the first player to the safe option, then resolve clean.
    const chosen = reduce(
      state,
      { t: 'CHOOSE_OPTION', optionId: room.options[0]!.id, committed: [state.crew[0]!.id] },
      cfg,
    );
    inOffer = reduce(chosen, { t: 'RESOLVE_MINIGAME', outcome: 'clean' }, cfg);
  } else {
    inOffer = reduce(state, { t: 'CHOOSE_SCENARIO', choiceId: room.choices[0].id }, cfg);
  }

  return reduce(inOffer, { t: 'PUSH_ON' }, cfg);
}

/**
 * Return a diverse array of reachable RunStates for the given seed/crewSize:
 *   [0] initial state (phase 'room', roomIndex 0)
 *   [1] after 1 room resolved (non-zero history, possible restingUntilRoom for crew ≥ 4)
 *   [2] after 2 rooms resolved (accumulated heat/loot)
 *   [3] getaway-phase variant (any GM can jump phase at any time)
 *
 * Stops advancing early if heat forces an emergency getaway (rare in tests; heat
 * rises by ~1/room from the safe option so this won't happen within 2 rooms at
 * the default hMax of 20).
 */
function buildStateVariants(seed: number, crewSize: number): RunState[] {
  const initial = buildState(seed, crewSize);
  const variants: RunState[] = [initial];

  let state = initial;
  for (let i = 0; i < 2 && state.phase === 'room'; i++) {
    state = advanceOneRoom(state);
    variants.push(state);
  }

  // Always add a getaway-phase variant (the GM can jump phase at any time).
  const last = variants[variants.length - 1]!;
  if (last.phase !== 'getaway') {
    variants.push({ ...last, phase: 'getaway' as const });
  }

  return variants;
}

// ─── Property: no dead-ends ───────────────────────────────────────────────────

describe('no-dead-end: every tracked field can be driven to any legal value', () => {
  it('heat can be set to 0, mid-range, and hMax from any state', () => {
    for (const seed of SEEDS) {
      for (const crewSize of CREW_SIZES) {
        for (const state of buildStateVariants(seed, crewSize)) {
          for (const target of [0, 7, cfg.heat.hMax]) {
            const session = initialSession(state);
            const after = reduceSession(session, { t: 'OVERRIDE_SET_HEAT', value: target }, cfg);
            expect(after.present.heat).toBe(target);
          }
        }
      }
    }
  });

  it('loot can be set to 0 and an arbitrarily large value from any state', () => {
    for (const seed of SEEDS) {
      for (const state of buildStateVariants(seed, 3)) {
        for (const target of [0, 25, 100]) {
          const session = initialSession(state);
          const after = reduceSession(session, { t: 'OVERRIDE_SET_LOOT', value: target }, cfg);
          expect(after.present.loot).toBe(target);
        }
      }
    }
  });

  it('phase can be jumped to any RunPhase from any state', () => {
    for (const seed of SEEDS) {
      for (const state of buildStateVariants(seed, 2)) {
        for (const phase of PHASES) {
          const session = initialSession(state);
          const after = reduceSession(session, { t: 'OVERRIDE_SET_PHASE', phase }, cfg);
          expect(after.present.phase).toBe(phase);
        }
      }
    }
  });

  it('stats[lane] can be set to any value for every player in every state', () => {
    for (const seed of SEEDS) {
      for (const state of buildStateVariants(seed, 3)) {
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
    }
  });

  it('powerUps[lane] can be granted (true) for every player × lane', () => {
    for (const seed of SEEDS) {
      for (const state of buildStateVariants(seed, 2)) {
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
    }
  });

  it('powerUps[lane] can be removed (false) for every player × lane', () => {
    // Start from a state where all power-ups are held so removal is non-trivial.
    for (const seed of SEEDS) {
      for (const baseVariant of buildStateVariants(seed, 2)) {
        let state = baseVariant;
        // Grant all power-ups first
        for (const player of state.crew) {
          for (const lane of LANES) {
            state = reduce(state, { t: 'OVERRIDE_SET_POWERUP', player: player.id, lane, held: true }, cfg);
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
    }
  });

  it('restingUntilRoom can be set and cleared for every player', () => {
    for (const seed of SEEDS) {
      for (const state of buildStateVariants(seed, 3)) {
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
      for (const [vi, state] of buildStateVariants(seed, crewSize).entries()) {
        it(`seed=${seed}, crew=${crewSize}, variant=${vi}: every override undoes cleanly`, () => {
          assertUndoRestores(state);
        });
      }
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
