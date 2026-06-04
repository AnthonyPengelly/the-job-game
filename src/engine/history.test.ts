import { describe, it, expect } from 'vitest';
import { reduceSession, initialSession } from '@/engine/history';
import { reduce } from '@/engine/reduce';
import { initialState } from '@/engine/run';
import { testCfg as cfg } from '@/engine/test-config';
import type { RunState, PlayerId } from '@/engine/types';

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
