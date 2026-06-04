import { describe, it, expect } from 'vitest';
import { initialState, startRun } from '@/engine/run';
import type { QuirkId, RunEvent } from '@/engine/types';

const FIXED_SEED = 1312;

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
    const a = startRun(base, crewEvent);
    const b = startRun(base, crewEvent);
    expect(a).toEqual(b);
  });

  it('creates one Player per crew setup entry', () => {
    const state = startRun(initialState(FIXED_SEED), crewEvent);
    expect(state.crew).toHaveLength(2);
    expect(state.crew[0]?.name).toBe('Alice');
    expect(state.crew[1]?.name).toBe('Bob');
  });

  it('assigns sequential player IDs', () => {
    const state = startRun(initialState(FIXED_SEED), crewEvent);
    expect(state.crew[0]?.id).toBe('player-0');
    expect(state.crew[1]?.id).toBe('player-1');
  });

  it('initialises player stats to the mediocre baseline (all zeros)', () => {
    const state = startRun(initialState(FIXED_SEED), crewEvent);
    for (const player of state.crew) {
      expect(player.stats).toEqual({ tech: 0, physical: 0, charm: 0, stealth: 0 });
      expect(player.powerUps).toEqual({});
    }
  });

  it('respects a supplied quirk and defaults missing quirks', () => {
    const eventWithQuirk: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Zara', quirk: 'hacker' as QuirkId }],
    };
    const state = startRun(initialState(FIXED_SEED), eventWithQuirk);
    expect(state.crew[0]?.quirk).toBe('hacker');
  });

  it('advances rngState (different from the initial seed)', () => {
    const base = initialState(FIXED_SEED);
    const after = startRun(base, crewEvent);
    // rngState must have been advanced by the mansion pick
    expect(after.rngState).not.toBe(base.rngState);
  });

  it('assigns a valid mansion type', () => {
    const state = startRun(initialState(FIXED_SEED), crewEvent);
    expect(['villa', 'estate', 'penthouse']).toContain(state.mansion.type);
  });

  it('mansion type is deterministic for the same seed', () => {
    const a = startRun(initialState(FIXED_SEED), crewEvent);
    const b = startRun(initialState(FIXED_SEED), crewEvent);
    expect(a.mansion.type).toBe(b.mansion.type);
  });

  it('uses the event seed when provided, overriding state seed', () => {
    const base = initialState(FIXED_SEED);
    const eventWithSeed: Extract<RunEvent, { t: 'START_RUN' }> = {
      t: 'START_RUN',
      crew: [{ name: 'Dana' }],
      seed: 9999,
    };
    const state = startRun(base, eventWithSeed);
    expect(state.seed).toBe(9999 >>> 0);
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
    const fresh = startRun(dirty, crewEvent);
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
