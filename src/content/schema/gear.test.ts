import { describe, it, expect } from 'vitest';
import { gearSchema } from './gear';

const validItem_statBoost = {
  id: 'stat-tech-1',
  kind: 'statBoost' as const,
  lane: 'tech' as const,
  magnitude: 1,
  name: 'Burner Laptop',
  blurb: 'Pre-loaded exploits, zero serial numbers.',
};

const validItem_powerUp = {
  id: 'powerup-tech',
  kind: 'powerUp' as const,
  lane: 'tech' as const,
  name: 'Hacker\'s Rig',
  blurb: 'One shouted play per job.',
};

const minimalValidPack = {
  _meta: { pack: 'gear', version: 1, source: 'test', units: {} },
  items: [validItem_statBoost, validItem_powerUp],
};

describe('gearSchema', () => {
  it('accepts a minimal valid gear pack', () => {
    const result = gearSchema.safeParse(minimalValidPack);
    expect(result.success).toBe(true);
  });

  it('rejects a statBoost without a thematic name', () => {
    const nameless: Record<string, unknown> = { ...validItem_statBoost };
    delete nameless['name'];
    const pack = { ...minimalValidPack, items: [nameless] };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects a powerUp without a blurb', () => {
    const blurbless: Record<string, unknown> = { ...validItem_powerUp };
    delete blurbless['blurb'];
    const pack = { ...minimalValidPack, items: [blurbless] };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects an empty name', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ ...validItem_statBoost, name: '' }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects statBoost missing magnitude', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ id: 'x', kind: 'statBoost', lane: 'tech', name: 'X', blurb: 'Y.' }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects invalid lane value', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ ...validItem_statBoost, lane: 'agility' }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects unknown kind', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ id: 'x', kind: 'gear', lane: 'tech', name: 'X', blurb: 'Y.' }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects extra top-level fields (strict)', () => {
    const pack = { ...minimalValidPack, extra: true };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects extra fields on a statBoost item (strict)', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ ...validItem_statBoost, extra: 'field' }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects the retired flavour array (strict)', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ ...validItem_statBoost, flavour: ['Better Tools'] }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects wrong _meta.pack value', () => {
    const pack = {
      ...minimalValidPack,
      _meta: { ...minimalValidPack._meta, pack: 'tuning' },
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects magnitude of 0 (must be positive)', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ ...validItem_statBoost, magnitude: 0 }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });
});
