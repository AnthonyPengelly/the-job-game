import { describe, it, expect } from 'vitest';
import { gearSchema } from './gear';

const validItem_statBoost = {
  id: 'stat-tech-1',
  kind: 'statBoost' as const,
  lane: 'tech' as const,
  magnitude: 1,
  flavour: ['Better Tools'],
};

const validItem_powerUp = {
  id: 'powerup-tech',
  kind: 'powerUp' as const,
  lane: 'tech' as const,
  flavour: ['Hacker\'s Rig'],
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

  it('accepts statBoost without optional flavour', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ id: 'x', kind: 'statBoost', lane: 'physical', magnitude: 2 }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(true);
  });

  it('accepts powerUp without optional flavour', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ id: 'x', kind: 'powerUp', lane: 'charm' }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(true);
  });

  it('rejects statBoost missing magnitude', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ id: 'x', kind: 'statBoost', lane: 'tech' }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects invalid lane value', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ id: 'x', kind: 'statBoost', lane: 'agility', magnitude: 1 }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects unknown kind', () => {
    const pack = {
      ...minimalValidPack,
      items: [{ id: 'x', kind: 'gear', lane: 'tech' }],
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
      items: [{ id: 'x', kind: 'statBoost', lane: 'tech', magnitude: 0 }],
    };
    expect(gearSchema.safeParse(pack).success).toBe(false);
  });
});
