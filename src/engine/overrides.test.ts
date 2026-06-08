import { describe, it, expect } from 'vitest';
import { reduce } from '@/engine/reduce';
import { applyOverride } from '@/engine/overrides';
import { initialState } from '@/engine/run';
import { isResting } from '@/engine/crew';
import type { EngineConfig } from '@/engine/config';
import type { RunState, PlayerId, RunPhase } from '@/engine/types';

// ─── Inline test config ───────────────────────────────────────────────────────

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
    heatDial: { perHeat: 0, perRoom: 0 },
  },
  generation: { obstacleRatio: 0.8 },
  scenario: { dcClamp: [1, 20] as [number, number], easeDialSteps: 1, critFumble: false, heatDC: { perHeat: 0, perRoom: 0 } },
  rewardScale: { perHeat: 0, perRoom: 0 },
  gearSellValue: { base: 1000, perRoom: 500 },
  gear: {},
  banks: { categories: [], trivia: [] },
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
        setup: 'A clerk offers to help.',
        choices: [
          { id: 's1-a', label: 'A', effect: { heatDelta: -1, lootDelta: 0 } },
          { id: 's1-b', label: 'B', effect: { heatDelta:  0, lootDelta: 1 } },
        ],
      },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal state with one player ready for override tests. */
function baseState(overrides: Partial<RunState> = {}): RunState {
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
      {
        id: 'p1' as PlayerId,
        name: 'Bob',
        stats: { tech: 0, physical: 2, charm: 0, stealth: 0 },
        powerUps: { charm: true },
      },
    ],
    ...overrides,
  };
}

// ─── OVERRIDE_SET_HEAT ────────────────────────────────────────────────────────

describe('OVERRIDE_SET_HEAT', () => {
  it('sets heat to specified value', () => {
    const next = applyOverride(baseState(), { t: 'OVERRIDE_SET_HEAT', value: 8 }, cfg);
    expect(next.heat).toBe(8);
  });

  it('clamps to 0 below zero', () => {
    const next = applyOverride(baseState(), { t: 'OVERRIDE_SET_HEAT', value: -3 }, cfg);
    expect(next.heat).toBe(0);
  });

  it('clamps to hMax above maximum', () => {
    const next = applyOverride(baseState(), { t: 'OVERRIDE_SET_HEAT', value: 999 }, cfg);
    expect(next.heat).toBe(cfg.heat.hMax);
  });

  it('sets heat exactly to hMax', () => {
    const next = applyOverride(baseState(), { t: 'OVERRIDE_SET_HEAT', value: 20 }, cfg);
    expect(next.heat).toBe(20);
  });

  it('sets heat to 0', () => {
    const next = applyOverride(baseState({ heat: 15 }), { t: 'OVERRIDE_SET_HEAT', value: 0 }, cfg);
    expect(next.heat).toBe(0);
  });

  it('does not mutate input state', () => {
    const s = baseState({ heat: 5 });
    applyOverride(s, { t: 'OVERRIDE_SET_HEAT', value: 10 }, cfg);
    expect(s.heat).toBe(5);
  });

  it('leaves other state fields unchanged', () => {
    const s = baseState({ heat: 5, loot: 7 });
    const next = applyOverride(s, { t: 'OVERRIDE_SET_HEAT', value: 3 }, cfg);
    expect(next.loot).toBe(7);
    expect(next.phase).toBe(s.phase);
  });

  it('recomputes escapeSignal: arms when heat crosses run-at threshold', () => {
    // threshold = runAtFraction * hMax = 0.55 * 20 = 11; need roomIndex >= 2
    const s = baseState({ heat: 5, roomIndex: 3, escapeSignal: false });
    const next = applyOverride(s, { t: 'OVERRIDE_SET_HEAT', value: 11 }, cfg);
    expect(next.escapeSignal).toBe(true);
  });

  it('recomputes escapeSignal: clears when heat drops below run-at threshold', () => {
    const s = baseState({ heat: 15, roomIndex: 3, escapeSignal: true });
    const next = applyOverride(s, { t: 'OVERRIDE_SET_HEAT', value: 5 }, cfg);
    expect(next.escapeSignal).toBe(false);
  });
});

// ─── OVERRIDE_ADJUST_HEAT ─────────────────────────────────────────────────────

describe('OVERRIDE_ADJUST_HEAT', () => {
  it('increases heat by delta', () => {
    const next = applyOverride(baseState({ heat: 5 }), { t: 'OVERRIDE_ADJUST_HEAT', delta: 3 }, cfg);
    expect(next.heat).toBe(8);
  });

  it('decreases heat by negative delta', () => {
    const next = applyOverride(baseState({ heat: 5 }), { t: 'OVERRIDE_ADJUST_HEAT', delta: -3 }, cfg);
    expect(next.heat).toBe(2);
  });

  it('clamps to 0 on underflow', () => {
    const next = applyOverride(baseState({ heat: 2 }), { t: 'OVERRIDE_ADJUST_HEAT', delta: -10 }, cfg);
    expect(next.heat).toBe(0);
  });

  it('clamps to hMax on overflow', () => {
    const next = applyOverride(baseState({ heat: 18 }), { t: 'OVERRIDE_ADJUST_HEAT', delta: 10 }, cfg);
    expect(next.heat).toBe(cfg.heat.hMax);
  });

  it('recomputes escapeSignal: arms when adjusted heat crosses run-at threshold', () => {
    // threshold = 11; roomIndex must be >= 2
    const s = baseState({ heat: 9, roomIndex: 2, escapeSignal: false });
    const next = applyOverride(s, { t: 'OVERRIDE_ADJUST_HEAT', delta: 3 }, cfg);
    expect(next.escapeSignal).toBe(true);
  });

  it('recomputes escapeSignal: clears when adjusted heat drops below threshold', () => {
    const s = baseState({ heat: 15, roomIndex: 2, escapeSignal: true });
    const next = applyOverride(s, { t: 'OVERRIDE_ADJUST_HEAT', delta: -6 }, cfg);
    expect(next.escapeSignal).toBe(false);
  });
});

// ─── OVERRIDE_SET_LOOT ────────────────────────────────────────────────────────

describe('OVERRIDE_SET_LOOT', () => {
  it('sets loot to specified value', () => {
    const next = applyOverride(baseState(), { t: 'OVERRIDE_SET_LOOT', value: 12 }, cfg);
    expect(next.loot).toBe(12);
  });

  it('clamps to 0 below zero', () => {
    const next = applyOverride(baseState(), { t: 'OVERRIDE_SET_LOOT', value: -5 }, cfg);
    expect(next.loot).toBe(0);
  });

  it('sets loot to 0', () => {
    const next = applyOverride(baseState({ loot: 10 }), { t: 'OVERRIDE_SET_LOOT', value: 0 }, cfg);
    expect(next.loot).toBe(0);
  });
});

// ─── OVERRIDE_ADJUST_LOOT ─────────────────────────────────────────────────────

describe('OVERRIDE_ADJUST_LOOT', () => {
  it('increases loot by delta', () => {
    const next = applyOverride(baseState({ loot: 5 }), { t: 'OVERRIDE_ADJUST_LOOT', delta: 4 }, cfg);
    expect(next.loot).toBe(9);
  });

  it('decreases loot by negative delta', () => {
    const next = applyOverride(baseState({ loot: 5 }), { t: 'OVERRIDE_ADJUST_LOOT', delta: -3 }, cfg);
    expect(next.loot).toBe(2);
  });

  it('clamps to 0 on underflow', () => {
    const next = applyOverride(baseState({ loot: 2 }), { t: 'OVERRIDE_ADJUST_LOOT', delta: -10 }, cfg);
    expect(next.loot).toBe(0);
  });
});

// ─── OVERRIDE_SET_STAT ────────────────────────────────────────────────────────

describe('OVERRIDE_SET_STAT', () => {
  it('sets a stat on the specified player', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_STAT', player: 'p0' as PlayerId, lane: 'tech', value: 5 },
      cfg,
    );
    expect(next.crew[0]!.stats.tech).toBe(5);
  });

  it('leaves other lanes unchanged', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_STAT', player: 'p0' as PlayerId, lane: 'tech', value: 5 },
      cfg,
    );
    expect(next.crew[0]!.stats.physical).toBe(0);
    expect(next.crew[0]!.stats.charm).toBe(0);
  });

  it('leaves other players unchanged', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_STAT', player: 'p0' as PlayerId, lane: 'tech', value: 5 },
      cfg,
    );
    expect(next.crew[1]!.stats.physical).toBe(2);
  });

  it('sets stat to zero (remove boost)', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_STAT', player: 'p0' as PlayerId, lane: 'tech', value: 0 },
      cfg,
    );
    expect(next.crew[0]!.stats.tech).toBe(0);
  });

  it('throws on unknown player id', () => {
    expect(() =>
      applyOverride(
        baseState(),
        { t: 'OVERRIDE_SET_STAT', player: 'ghost' as PlayerId, lane: 'tech', value: 1 },
        cfg,
      ),
    ).toThrow(/unknown player id/i);
  });
});

// ─── OVERRIDE_ADJUST_STAT ─────────────────────────────────────────────────────

describe('OVERRIDE_ADJUST_STAT', () => {
  it('increments a stat by delta', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_ADJUST_STAT', player: 'p0' as PlayerId, lane: 'tech', delta: 2 },
      cfg,
    );
    expect(next.crew[0]!.stats.tech).toBe(3); // 1 + 2
  });

  it('decrements a stat by negative delta', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_ADJUST_STAT', player: 'p1' as PlayerId, lane: 'physical', delta: -1 },
      cfg,
    );
    expect(next.crew[1]!.stats.physical).toBe(1); // 2 - 1
  });

  it('leaves other players unchanged', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_ADJUST_STAT', player: 'p0' as PlayerId, lane: 'tech', delta: 3 },
      cfg,
    );
    expect(next.crew[1]!.stats.physical).toBe(2);
  });

  it('throws on unknown player id', () => {
    expect(() =>
      applyOverride(
        baseState(),
        { t: 'OVERRIDE_ADJUST_STAT', player: 'ghost' as PlayerId, lane: 'charm', delta: 1 },
        cfg,
      ),
    ).toThrow(/unknown player id/i);
  });
});

// ─── OVERRIDE_SET_POWERUP ─────────────────────────────────────────────────────

describe('OVERRIDE_SET_POWERUP', () => {
  it('grants a power-up (held: true)', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_POWERUP', player: 'p0' as PlayerId, lane: 'stealth', held: true },
      cfg,
    );
    expect(next.crew[0]!.powerUps.stealth).toBe(true);
  });

  it('is idempotent: granting an already-held power-up stays true', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_POWERUP', player: 'p1' as PlayerId, lane: 'charm', held: true },
      cfg,
    );
    expect(next.crew[1]!.powerUps.charm).toBe(true);
  });

  it('removes a power-up (held: false)', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_POWERUP', player: 'p1' as PlayerId, lane: 'charm', held: false },
      cfg,
    );
    expect(next.crew[1]!.powerUps.charm).toBeUndefined();
  });

  it('removing an absent power-up is a no-op', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_POWERUP', player: 'p0' as PlayerId, lane: 'tech', held: false },
      cfg,
    );
    expect(next.crew[0]!.powerUps.tech).toBeUndefined();
  });

  it('leaves other players unchanged', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_POWERUP', player: 'p0' as PlayerId, lane: 'stealth', held: true },
      cfg,
    );
    // p1 still has charm but no stealth
    expect(next.crew[1]!.powerUps.stealth).toBeUndefined();
  });

  it('throws on unknown player id', () => {
    expect(() =>
      applyOverride(
        baseState(),
        { t: 'OVERRIDE_SET_POWERUP', player: 'ghost' as PlayerId, lane: 'tech', held: true },
        cfg,
      ),
    ).toThrow(/unknown player id/i);
  });
});

// ─── OVERRIDE_SET_RESTING ─────────────────────────────────────────────────────

describe('OVERRIDE_SET_RESTING', () => {
  it('sets restingUntilRoom on a player', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_RESTING', player: 'p0' as PlayerId, untilRoom: 5 },
      cfg,
    );
    expect(next.crew[0]!.restingUntilRoom).toBe(5);
  });

  it('player reads as resting while roomIndex <= untilRoom', () => {
    const next = applyOverride(
      baseState({ roomIndex: 4 }),
      { t: 'OVERRIDE_SET_RESTING', player: 'p0' as PlayerId, untilRoom: 5 },
      cfg,
    );
    expect(isResting(next.crew[0]!, 4)).toBe(true);
    expect(isResting(next.crew[0]!, 5)).toBe(true);
    expect(isResting(next.crew[0]!, 6)).toBe(false);
  });

  it('clears restingUntilRoom when untilRoom is omitted', () => {
    const resting = baseState({
      crew: [
        {
          id: 'p0' as PlayerId,
          name: 'Alice',
          stats: { tech: 0, physical: 0, charm: 0, stealth: 0 },
          powerUps: {},
          restingUntilRoom: 10,
        },
      ],
    });
    const next = applyOverride(
      resting,
      { t: 'OVERRIDE_SET_RESTING', player: 'p0' as PlayerId },
      cfg,
    );
    expect(next.crew[0]!.restingUntilRoom).toBeUndefined();
    expect(isResting(next.crew[0]!, 10)).toBe(false);
  });

  it('un-resting a player who is not resting is a no-op', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_RESTING', player: 'p0' as PlayerId },
      cfg,
    );
    expect(next.crew[0]!.restingUntilRoom).toBeUndefined();
  });

  it('leaves other players unchanged', () => {
    const next = applyOverride(
      baseState(),
      { t: 'OVERRIDE_SET_RESTING', player: 'p0' as PlayerId, untilRoom: 3 },
      cfg,
    );
    expect(next.crew[1]!.restingUntilRoom).toBeUndefined();
  });

  it('throws on unknown player id', () => {
    expect(() =>
      applyOverride(
        baseState(),
        { t: 'OVERRIDE_SET_RESTING', player: 'ghost' as PlayerId, untilRoom: 3 },
        cfg,
      ),
    ).toThrow(/unknown player id/i);
  });
});

// ─── OVERRIDE_REROLL_ROOM ─────────────────────────────────────────────────────

describe('OVERRIDE_REROLL_ROOM', () => {
  it('produces a new room', () => {
    const s = baseState({ rngState: 12345 });
    const next = applyOverride(s, { t: 'OVERRIDE_REROLL_ROOM' }, cfg);
    expect(next.currentRoom).not.toBeNull();
  });

  it('advances rngState', () => {
    const s = baseState({ rngState: 99 });
    const next = applyOverride(s, { t: 'OVERRIDE_REROLL_ROOM' }, cfg);
    expect(next.rngState).not.toBe(s.rngState);
  });

  it('is deterministic: same rngState ⇒ same rerolled room', () => {
    const s = baseState({ rngState: 7777 });
    const r1 = applyOverride(s, { t: 'OVERRIDE_REROLL_ROOM' }, cfg);
    const r2 = applyOverride(s, { t: 'OVERRIDE_REROLL_ROOM' }, cfg);
    expect(r1.currentRoom).toEqual(r2.currentRoom);
    expect(r1.rngState).toBe(r2.rngState);
  });

  it('does not mutate the input state', () => {
    const s = baseState({ rngState: 42 });
    const beforeRng = s.rngState;
    applyOverride(s, { t: 'OVERRIDE_REROLL_ROOM' }, cfg);
    expect(s.rngState).toBe(beforeRng);
  });

  it('preserves carried effects (no tick — roomIndex does not advance)', () => {
    const carried = [{ id: 'briefcase', kind: 'countdown', roomsLeft: 2 }];
    const s = baseState({ rngState: 100, carried });
    const next = applyOverride(s, { t: 'OVERRIDE_REROLL_ROOM' }, cfg);
    expect(next.carried).toEqual(carried);
  });
});

// ─── OVERRIDE_SKIP_ROOM ───────────────────────────────────────────────────────

describe('OVERRIDE_SKIP_ROOM', () => {
  it('increments roomIndex', () => {
    const s = baseState({ roomIndex: 2 });
    const next = applyOverride(s, { t: 'OVERRIDE_SKIP_ROOM' }, cfg);
    expect(next.roomIndex).toBe(3);
  });

  it('generates a new room and sets phase to room', () => {
    const s = baseState({ roomIndex: 0 });
    const next = applyOverride(s, { t: 'OVERRIDE_SKIP_ROOM' }, cfg);
    expect(next.currentRoom).not.toBeNull();
    expect(next.phase).toBe('room');
  });

  it('advances rngState (room generation draws at least once)', () => {
    const s = baseState({ roomIndex: 0 });
    const next = applyOverride(s, { t: 'OVERRIDE_SKIP_ROOM' }, cfg);
    expect(next.rngState).not.toBe(s.rngState);
  });

  it('does NOT apply forcedGetaway even at max heat', () => {
    // GM is explicitly skipping — not subject to the normal forced-getaway check.
    const s = baseState({ roomIndex: 3, heat: cfg.heat.hMax });
    const next = applyOverride(s, { t: 'OVERRIDE_SKIP_ROOM' }, cfg);
    expect(next.phase).toBe('room');
  });

  it('is deterministic: same state ⇒ same skipped room', () => {
    const s = baseState({ roomIndex: 1, rngState: 5678 });
    const r1 = applyOverride(s, { t: 'OVERRIDE_SKIP_ROOM' }, cfg);
    const r2 = applyOverride(s, { t: 'OVERRIDE_SKIP_ROOM' }, cfg);
    expect(r1.currentRoom).toEqual(r2.currentRoom);
    expect(r1.roomIndex).toBe(r2.roomIndex);
  });

  it('recomputes escapeSignal: arms when skip brings roomIndex to threshold with hot heat', () => {
    // threshold: roomIndex >= 2 AND heat >= 11
    const s = baseState({ roomIndex: 1, heat: 12, escapeSignal: false });
    const next = applyOverride(s, { t: 'OVERRIDE_SKIP_ROOM' }, cfg);
    expect(next.roomIndex).toBe(2);
    expect(next.escapeSignal).toBe(true);
  });

  it('recomputes escapeSignal: stays false when heat is below threshold after skip', () => {
    const s = baseState({ roomIndex: 1, heat: 5, escapeSignal: false });
    const next = applyOverride(s, { t: 'OVERRIDE_SKIP_ROOM' }, cfg);
    expect(next.escapeSignal).toBe(false);
  });
});

// ─── OVERRIDE_SET_PHASE ───────────────────────────────────────────────────────

describe('OVERRIDE_SET_PHASE', () => {
  const phases: RunPhase[] = ['briefing', 'room', 'minigame', 'offer', 'getaway', 'result'];

  for (const phase of phases) {
    it(`jumps to phase "${phase}"`, () => {
      const next = applyOverride(baseState(), { t: 'OVERRIDE_SET_PHASE', phase }, cfg);
      expect(next.phase).toBe(phase);
    });
  }

  it('preserves all other state fields when changing phase', () => {
    const s = baseState({ heat: 7, loot: 4 });
    const next = applyOverride(s, { t: 'OVERRIDE_SET_PHASE', phase: 'getaway' }, cfg);
    expect(next.heat).toBe(7);
    expect(next.loot).toBe(4);
    expect(next.crew).toEqual(s.crew);
  });
});

// ─── reduce delegates overrides ───────────────────────────────────────────────

describe('reduce delegates override events', () => {
  it('OVERRIDE_SET_HEAT via reduce', () => {
    const s = baseState({ heat: 5 });
    const next = reduce(s, { t: 'OVERRIDE_SET_HEAT', value: 15 }, cfg);
    expect(next.heat).toBe(15);
  });

  it('OVERRIDE_SET_LOOT via reduce', () => {
    const s = baseState({ loot: 3 });
    const next = reduce(s, { t: 'OVERRIDE_SET_LOOT', value: 9 }, cfg);
    expect(next.loot).toBe(9);
  });

  it('OVERRIDE_SET_STAT via reduce', () => {
    const s = baseState();
    const next = reduce(
      s,
      { t: 'OVERRIDE_SET_STAT', player: 'p0' as PlayerId, lane: 'charm', value: 3 },
      cfg,
    );
    expect(next.crew[0]!.stats.charm).toBe(3);
  });

  it('OVERRIDE_SET_POWERUP via reduce', () => {
    const s = baseState();
    const next = reduce(
      s,
      { t: 'OVERRIDE_SET_POWERUP', player: 'p0' as PlayerId, lane: 'tech', held: true },
      cfg,
    );
    expect(next.crew[0]!.powerUps.tech).toBe(true);
  });

  it('OVERRIDE_SET_RESTING via reduce', () => {
    const s = baseState({ roomIndex: 2 });
    const next = reduce(
      s,
      { t: 'OVERRIDE_SET_RESTING', player: 'p0' as PlayerId, untilRoom: 4 },
      cfg,
    );
    expect(next.crew[0]!.restingUntilRoom).toBe(4);
  });

  it('OVERRIDE_REROLL_ROOM via reduce advances rngState', () => {
    const s = baseState();
    const next = reduce(s, { t: 'OVERRIDE_REROLL_ROOM' }, cfg);
    expect(next.rngState).not.toBe(s.rngState);
  });

  it('OVERRIDE_SKIP_ROOM via reduce increments roomIndex', () => {
    const s = baseState({ roomIndex: 1 });
    const next = reduce(s, { t: 'OVERRIDE_SKIP_ROOM' }, cfg);
    expect(next.roomIndex).toBe(2);
  });

  it('OVERRIDE_SET_PHASE via reduce', () => {
    const s = baseState({ phase: 'room' });
    const next = reduce(s, { t: 'OVERRIDE_SET_PHASE', phase: 'result' }, cfg);
    expect(next.phase).toBe('result');
  });

  it('OVERRIDE_ADJUST_HEAT via reduce clamps to hMax', () => {
    const s = baseState({ heat: 18 });
    const next = reduce(s, { t: 'OVERRIDE_ADJUST_HEAT', delta: 100 }, cfg);
    expect(next.heat).toBe(cfg.heat.hMax);
  });

  it('OVERRIDE_ADJUST_LOOT via reduce clamps to 0', () => {
    const s = baseState({ loot: 1 });
    const next = reduce(s, { t: 'OVERRIDE_ADJUST_LOOT', delta: -99 }, cfg);
    expect(next.loot).toBe(0);
  });

  it('OVERRIDE_ADJUST_STAT via reduce', () => {
    const s = baseState();
    const next = reduce(
      s,
      { t: 'OVERRIDE_ADJUST_STAT', player: 'p1' as PlayerId, lane: 'physical', delta: -1 },
      cfg,
    );
    expect(next.crew[1]!.stats.physical).toBe(1); // 2 - 1
  });
});

// ─── No mutation ─────────────────────────────────────────────────────────────

describe('applyOverride does not mutate input state', () => {
  it('OVERRIDE_SET_HEAT', () => {
    const s = baseState({ heat: 5 });
    applyOverride(s, { t: 'OVERRIDE_SET_HEAT', value: 10 }, cfg);
    expect(s.heat).toBe(5);
  });

  it('OVERRIDE_SET_STAT does not mutate crew', () => {
    const s = baseState();
    const originalTech = s.crew[0]!.stats.tech;
    applyOverride(
      s,
      { t: 'OVERRIDE_SET_STAT', player: 'p0' as PlayerId, lane: 'tech', value: 99 },
      cfg,
    );
    expect(s.crew[0]!.stats.tech).toBe(originalTech);
  });

  it('OVERRIDE_SET_POWERUP does not mutate crew', () => {
    const s = baseState();
    applyOverride(
      s,
      { t: 'OVERRIDE_SET_POWERUP', player: 'p0' as PlayerId, lane: 'stealth', held: true },
      cfg,
    );
    expect(s.crew[0]!.powerUps.stealth).toBeUndefined();
  });

  it('OVERRIDE_SET_RESTING does not mutate crew', () => {
    const s = baseState();
    applyOverride(
      s,
      { t: 'OVERRIDE_SET_RESTING', player: 'p0' as PlayerId, untilRoom: 8 },
      cfg,
    );
    expect(s.crew[0]!.restingUntilRoom).toBeUndefined();
  });
});

// ─── Heat clamp: [0, hMax] ────────────────────────────────────────────────────

describe('Heat clamps [0, hMax]', () => {
  it('SET_HEAT: 0 is the floor', () => {
    expect(applyOverride(baseState({ heat: 0 }), { t: 'OVERRIDE_SET_HEAT', value: 0 }, cfg).heat).toBe(0);
  });

  it('SET_HEAT: hMax is the ceiling', () => {
    expect(applyOverride(baseState({ heat: 10 }), { t: 'OVERRIDE_SET_HEAT', value: cfg.heat.hMax }, cfg).heat).toBe(cfg.heat.hMax);
  });

  it('ADJUST_HEAT: negative delta below 0 clamps to 0', () => {
    expect(applyOverride(baseState({ heat: 0 }), { t: 'OVERRIDE_ADJUST_HEAT', delta: -1 }, cfg).heat).toBe(0);
  });

  it('ADJUST_HEAT: positive delta above hMax clamps to hMax', () => {
    expect(applyOverride(baseState({ heat: cfg.heat.hMax }), { t: 'OVERRIDE_ADJUST_HEAT', delta: 1 }, cfg).heat).toBe(cfg.heat.hMax);
  });
});

// ─── Loot clamp: ≥ 0 ─────────────────────────────────────────────────────────

describe('Loot clamp ≥ 0', () => {
  it('SET_LOOT: 0 is the floor', () => {
    expect(applyOverride(baseState({ loot: 5 }), { t: 'OVERRIDE_SET_LOOT', value: 0 }, cfg).loot).toBe(0);
  });

  it('ADJUST_LOOT: negative delta below 0 clamps to 0', () => {
    expect(applyOverride(baseState({ loot: 0 }), { t: 'OVERRIDE_ADJUST_LOOT', delta: -1 }, cfg).loot).toBe(0);
  });
});
