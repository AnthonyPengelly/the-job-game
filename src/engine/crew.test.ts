import { describe, it, expect } from 'vitest';
import { applyGear, profileFor, isResting, applyExhaustion } from './crew';
import type { Player, PlayerId } from './types';
import type { GearDef, EngineConfig } from './config';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-0' as PlayerId,
    name: 'Alice',
    stats: { tech: 0, physical: 0, charm: 0, stealth: 0 },
    powerUps: {},
    ...overrides,
  };
}

const techBoost1: GearDef = { id: 'stat-tech-1', kind: 'statBoost', lane: 'tech', magnitude: 1 };
const techBoost2: GearDef = { id: 'stat-tech-2', kind: 'statBoost', lane: 'tech', magnitude: 2 };
const charmBoost1: GearDef = { id: 'stat-charm-1', kind: 'statBoost', lane: 'charm', magnitude: 1 };
const techPowerUp: GearDef = { id: 'powerup-tech', kind: 'powerUp', lane: 'tech' };
const stealthPowerUp: GearDef = { id: 'powerup-stealth', kind: 'powerUp', lane: 'stealth' };

describe('applyGear — statBoost', () => {
  it('+1 boost increases the lane stat by 1', () => {
    const p = makePlayer();
    const result = applyGear(p, techBoost1);
    expect(result.stats.tech).toBe(1);
  });

  it('+1 then +1 on same lane stacks to +2', () => {
    const p = makePlayer();
    const after1 = applyGear(p, techBoost1);
    const after2 = applyGear(after1, techBoost1);
    expect(after2.stats.tech).toBe(2);
  });

  it('+2 Big Score increases the lane stat by 2', () => {
    const p = makePlayer();
    const result = applyGear(p, techBoost2);
    expect(result.stats.tech).toBe(2);
  });

  it('+1 then +2 stacks to +3', () => {
    const p = makePlayer();
    const after1 = applyGear(p, techBoost1);
    const after2 = applyGear(after1, techBoost2);
    expect(after2.stats.tech).toBe(3);
  });

  it('only affects the targeted lane, not others', () => {
    const p = makePlayer();
    const result = applyGear(p, techBoost1);
    expect(result.stats.physical).toBe(0);
    expect(result.stats.charm).toBe(0);
    expect(result.stats.stealth).toBe(0);
  });

  it('boosts on different lanes are independent', () => {
    const p = makePlayer();
    const after = applyGear(applyGear(p, techBoost1), charmBoost1);
    expect(after.stats.tech).toBe(1);
    expect(after.stats.charm).toBe(1);
    expect(after.stats.physical).toBe(0);
  });

  it('does not mutate the input player', () => {
    const p = makePlayer();
    applyGear(p, techBoost1);
    expect(p.stats.tech).toBe(0);
  });
});

describe('applyGear — powerUp', () => {
  it('sets the power-up lane to true', () => {
    const p = makePlayer();
    const result = applyGear(p, techPowerUp);
    expect(result.powerUps.tech).toBe(true);
  });

  it('is idempotent: applying the same power-up twice is a no-op', () => {
    const p = makePlayer();
    const after1 = applyGear(p, techPowerUp);
    const after2 = applyGear(after1, techPowerUp);
    expect(after2.powerUps.tech).toBe(true);
    expect(Object.keys(after2.powerUps)).toHaveLength(1);
  });

  it('does not affect other lanes', () => {
    const p = makePlayer();
    const result = applyGear(p, techPowerUp);
    expect(result.powerUps.physical).toBeUndefined();
    expect(result.powerUps.charm).toBeUndefined();
    expect(result.powerUps.stealth).toBeUndefined();
  });

  it('two different power-ups accumulate independently', () => {
    const p = makePlayer();
    const after = applyGear(applyGear(p, techPowerUp), stealthPowerUp);
    expect(after.powerUps.tech).toBe(true);
    expect(after.powerUps.stealth).toBe(true);
  });

  it('does not mutate the input player', () => {
    const p = makePlayer();
    applyGear(p, techPowerUp);
    expect(p.powerUps.tech).toBeUndefined();
  });

  it('does not affect stats', () => {
    const p = makePlayer();
    const result = applyGear(p, techPowerUp);
    expect(result.stats.tech).toBe(0);
  });
});

// ─── Scaling / exhaustion helpers ─────────────────────────────────────────────

const scalingCfg: Pick<EngineConfig, 'scaling'> = {
  scaling: {
    profiles: {
      '2': { getawayBonus: -0.04, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '3': { getawayBonus: -0.02, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '4': { getawayBonus: 0.0,   crewPerOption: [1, 2] as [number, number], exhaustion: 'light' as const },
      '5': { getawayBonus: 0.02,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '6': { getawayBonus: 0.035, crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '7': { getawayBonus: 0.05,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
    },
    exhaustionRest: { full: 1, light: 1, tired: 0 },
    minCommit: {},
    variant: {},
    excludedFromSolo: [],
    soloEligibleMinPool: 8,
    dialCurve: { _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 } },
  },
} as unknown as Pick<EngineConfig, 'scaling'>;

// Cast to full EngineConfig — only scaling fields are accessed by the helpers under test.
const cfg = scalingCfg as unknown as EngineConfig;

function makePlayerWithId(id: string): Player {
  return makePlayer({ id: id as PlayerId });
}

describe('profileFor', () => {
  it('returns the profile for headcount 4 (light)', () => {
    const p = profileFor(4, cfg);
    expect(p.exhaustion).toBe('light');
  });

  it('returns the profile for headcount 7 (full)', () => {
    const p = profileFor(7, cfg);
    expect(p.exhaustion).toBe('full');
  });

  it('returns the profile for headcount 2 (tired)', () => {
    const p = profileFor(2, cfg);
    expect(p.exhaustion).toBe('tired');
  });

  it('clamps headcount < 2 to profile "2"', () => {
    const p = profileFor(1, cfg);
    expect(p.exhaustion).toBe('tired');
  });

  it('clamps headcount > 7 to profile "7"', () => {
    const p = profileFor(8, cfg);
    expect(p.exhaustion).toBe('full');
  });

  it('intermediate headcount 5 returns full', () => {
    const p = profileFor(5, cfg);
    expect(p.exhaustion).toBe('full');
  });

  it('intermediate headcount 3 returns tired', () => {
    const p = profileFor(3, cfg);
    expect(p.exhaustion).toBe('tired');
  });
});

describe('isResting', () => {
  it('returns false when restingUntilRoom is undefined', () => {
    const p = makePlayer();
    expect(isResting(p, 0)).toBe(false);
    expect(isResting(p, 5)).toBe(false);
  });

  it('returns true when roomIndex === restingUntilRoom (still benched)', () => {
    const p = makePlayer({ restingUntilRoom: 3 });
    expect(isResting(p, 3)).toBe(true);
  });

  it('returns true when roomIndex < restingUntilRoom', () => {
    const p = makePlayer({ restingUntilRoom: 5 });
    expect(isResting(p, 3)).toBe(true);
  });

  it('returns false when roomIndex > restingUntilRoom (available again)', () => {
    const p = makePlayer({ restingUntilRoom: 3 });
    expect(isResting(p, 4)).toBe(false);
  });
});

describe('applyExhaustion — full class (n=5..7)', () => {
  it('sets restingUntilRoom = roomIndex + 1 on committed crew (full, n=5)', () => {
    const crew = [makePlayerWithId('p0'), makePlayerWithId('p1'), makePlayerWithId('p2'), makePlayerWithId('p3'), makePlayerWithId('p4')];
    const result = applyExhaustion(crew, ['p0' as PlayerId, 'p1' as PlayerId], 3, cfg);
    expect(result[0]!.restingUntilRoom).toBe(4);
    expect(result[1]!.restingUntilRoom).toBe(4);
  });

  it('isResting reads true for committed player at the next room (full, n=7)', () => {
    const crew = Array.from({ length: 7 }, (_, i) => makePlayerWithId(`p${i}`));
    const committed = crew.slice(0, 3).map(p => p.id) as PlayerId[];
    const result = applyExhaustion(crew, committed, 2, cfg);
    // next room index is 3 = roomIndex + 1
    expect(isResting(result[0]!, 3)).toBe(true);
    expect(isResting(result[1]!, 3)).toBe(true);
    expect(isResting(result[2]!, 3)).toBe(true);
  });

  it('isResting reads false for committed player two rooms later (full)', () => {
    const crew = Array.from({ length: 7 }, (_, i) => makePlayerWithId(`p${i}`));
    const committed = crew.slice(0, 2).map(p => p.id) as PlayerId[];
    const result = applyExhaustion(crew, committed, 2, cfg);
    // room 4 = restingUntilRoom(3) + 1
    expect(isResting(result[0]!, 4)).toBe(false);
  });

  it('un-committed crew members are not benched (full, n=7)', () => {
    const crew = Array.from({ length: 7 }, (_, i) => makePlayerWithId(`p${i}`));
    const result = applyExhaustion(crew, ['p0' as PlayerId], 1, cfg);
    expect(result[1]!.restingUntilRoom).toBeUndefined();
    expect(isResting(result[1]!, 2)).toBe(false);
  });
});

describe('applyExhaustion — light class (n=4)', () => {
  it('sets restingUntilRoom = roomIndex + 1 on committed crew (light, n=4)', () => {
    const crew = [makePlayerWithId('p0'), makePlayerWithId('p1'), makePlayerWithId('p2'), makePlayerWithId('p3')];
    const result = applyExhaustion(crew, ['p0' as PlayerId], 5, cfg);
    expect(result[0]!.restingUntilRoom).toBe(6);
  });

  it('isResting reads true for committed player at next room (light, n=4)', () => {
    const crew = [makePlayerWithId('p0'), makePlayerWithId('p1'), makePlayerWithId('p2'), makePlayerWithId('p3')];
    const result = applyExhaustion(crew, ['p0' as PlayerId], 5, cfg);
    expect(isResting(result[0]!, 6)).toBe(true);
    expect(isResting(result[0]!, 7)).toBe(false);
  });
});

describe('applyExhaustion — tired class (n=2..3)', () => {
  it('does not bench anyone for n=2 (tired)', () => {
    const crew = [makePlayerWithId('p0'), makePlayerWithId('p1')];
    const result = applyExhaustion(crew, ['p0' as PlayerId, 'p1' as PlayerId], 2, cfg);
    expect(result[0]!.restingUntilRoom).toBeUndefined();
    expect(result[1]!.restingUntilRoom).toBeUndefined();
    expect(isResting(result[0]!, 3)).toBe(false);
  });

  it('does not bench anyone for n=3 (tired)', () => {
    const crew = [makePlayerWithId('p0'), makePlayerWithId('p1'), makePlayerWithId('p2')];
    const result = applyExhaustion(crew, crew.map(p => p.id) as PlayerId[], 0, cfg);
    expect(result.every(p => p.restingUntilRoom === undefined)).toBe(true);
  });

  it('returns the same array reference when nothing changes (tired)', () => {
    const crew = [makePlayerWithId('p0')];
    const result = applyExhaustion(crew, ['p0' as PlayerId], 0, cfg);
    expect(result).toBe(crew);
  });
});

describe('applyExhaustion — general', () => {
  it('does not mutate the input crew array', () => {
    const crew = [makePlayerWithId('p0'), makePlayerWithId('p1'), makePlayerWithId('p2'), makePlayerWithId('p3'), makePlayerWithId('p4')];
    const before = crew[0]!.restingUntilRoom;
    applyExhaustion(crew, ['p0' as PlayerId], 1, cfg);
    expect(crew[0]!.restingUntilRoom).toBe(before);
  });

  it('handles empty committedIds (no one benched)', () => {
    const crew = Array.from({ length: 7 }, (_, i) => makePlayerWithId(`p${i}`));
    const result = applyExhaustion(crew, [], 3, cfg);
    expect(result.every(p => p.restingUntilRoom === undefined)).toBe(true);
  });
});
