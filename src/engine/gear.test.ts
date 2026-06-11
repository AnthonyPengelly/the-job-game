import { describe, it, expect } from 'vitest';
import { computeGearSellValue, gearBonusPoints } from './gear';
import { testCfg } from './test-config';
import type { EngineConfig } from './config';
import type { GearId, GearGrantDescriptor } from './types';

// testCfg: perBonusPoint=1000, powerUpPoints=2, perRoom=500.
const cfg: EngineConfig = {
  ...testCfg,
  gear: {
    'stat-tech-1': { id: 'stat-tech-1', kind: 'statBoost', lane: 'tech', magnitude: 1, name: 'Burner Laptop', blurb: 'Test.' },
    'stat-tech-2': { id: 'stat-tech-2', kind: 'statBoost', lane: 'tech', magnitude: 2, name: 'Zero-Day Cache', blurb: 'Test.' },
    'powerup-tech': { id: 'powerup-tech', kind: 'powerUp', lane: 'tech', name: 'Hackers Rig', blurb: 'Test.' },
  },
};

const id = (s: string): GearId => s as GearId;

describe('gearBonusPoints', () => {
  it('statBoost is worth its magnitude', () => {
    expect(gearBonusPoints(id('stat-tech-1'), cfg)).toBe(1);
    expect(gearBonusPoints(id('stat-tech-2'), cfg)).toBe(2);
  });

  it('powerUp is worth cfg.gearSellValue.powerUpPoints', () => {
    expect(gearBonusPoints(id('powerup-tech'), cfg)).toBe(2);
  });

  it('descriptors price by their would-be resolution', () => {
    const statBoost: GearGrantDescriptor = { kind: 'statBoost', lane: 'tech' };
    const bigScore: GearGrantDescriptor = { kind: 'bigScore', lane: 'tech' };
    const powerUp: GearGrantDescriptor = { kind: 'powerUp', lanes: ['tech', 'charm'] };
    expect(gearBonusPoints(statBoost, cfg)).toBe(1);
    expect(gearBonusPoints(bigScore, cfg)).toBe(2);
    expect(gearBonusPoints(powerUp, cfg)).toBe(2);
  });

  it('an unknown GearId prices as 1 point (graceful at the table)', () => {
    expect(gearBonusPoints(id('not-in-catalog'), cfg)).toBe(1);
  });
});

describe('computeGearSellValue — visible rule', () => {
  it('a +1 sells for perBonusPoint at room 0', () => {
    expect(computeGearSellValue(id('stat-tech-1'), 0, cfg)).toBe(1000);
  });

  it('a +2 sells for exactly twice a +1 (same room)', () => {
    const plusOne = computeGearSellValue(id('stat-tech-1'), 0, cfg);
    const plusTwo = computeGearSellValue(id('stat-tech-2'), 0, cfg);
    expect(plusTwo).toBe(2 * plusOne);
  });

  it('selling deeper pays more (perRoom term)', () => {
    const early = computeGearSellValue(id('stat-tech-1'), 0, cfg);
    const late = computeGearSellValue(id('stat-tech-1'), 4, cfg);
    expect(late).toBe(early + 4 * cfg.gearSellValue.perRoom);
  });

  it('a power-up sells like a +2 under the default powerUpPoints', () => {
    expect(computeGearSellValue(id('powerup-tech'), 3, cfg)).toBe(
      computeGearSellValue(id('stat-tech-2'), 3, cfg),
    );
  });
});
