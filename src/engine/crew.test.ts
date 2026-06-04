import { describe, it, expect } from 'vitest';
import { applyGear } from './crew';
import type { Player, PlayerId } from './types';
import type { GearDef } from './config';

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
