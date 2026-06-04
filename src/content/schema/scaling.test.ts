import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { scalingSchema } from './scaling';

const validBase = {
  _meta: {
    pack: 'scaling' as const,
    version: 1,
    source: 'test',
    units: {},
  },
  profiles: {
    '2': { exhaustion: 'tired' as const, crewPerOption: [1, 2] as [number, number], getawayBonus: -0.04 },
    '4': { exhaustion: 'light' as const, crewPerOption: [1, 2] as [number, number], getawayBonus: 0.0 },
    '7': { exhaustion: 'full' as const, crewPerOption: [2, 3] as [number, number], getawayBonus: 0.05 },
  },
  exhaustionRest: { full: 1, light: 1, tired: 0 },
  minCommit: { crackTheTumblers: 1, assemblyLine: 2 },
  variant: {
    crackTheTumblers: { soloVariantId: 'crackTheTumblersSolo', appliesAt: [1] },
  },
  excludedFromSolo: ['assemblyLine', 'defuseTheAlarm'],
  soloEligibleMinPool: 8,
  dialCurve: {
    _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 },
  },
};

describe('scalingSchema', () => {
  it('accepts a valid full scaling pack', () => {
    expect(() => scalingSchema.parse(validBase)).not.toThrow();
  });

  it('rejects missing exhaustionRest', () => {
    const without = {
      ...validBase,
      // deliberately omit exhaustionRest by overriding with undefined — parser sees a missing field
    } as Record<string, unknown>;
    delete without['exhaustionRest'];
    expect(() => scalingSchema.parse(without)).toThrow(ZodError);
  });

  it('rejects exhaustionRest with a negative value', () => {
    const bad = { ...validBase, exhaustionRest: { full: -1, light: 1, tired: 0 } };
    expect(() => scalingSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects exhaustionRest with a non-integer value', () => {
    const bad = { ...validBase, exhaustionRest: { full: 1.5, light: 1, tired: 0 } };
    expect(() => scalingSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects exhaustionRest missing a key', () => {
    const bad = { ...validBase, exhaustionRest: { full: 1, light: 1 } };
    expect(() => scalingSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects exhaustionRest with an extra unknown key (strict)', () => {
    const bad = { ...validBase, exhaustionRest: { full: 1, light: 1, tired: 0, extra: 99 } };
    expect(() => scalingSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects a profile with an invalid exhaustion class', () => {
    const bad = {
      ...validBase,
      profiles: {
        '4': { exhaustion: 'heavy', crewPerOption: [1, 2], getawayBonus: 0.0 },
      },
    };
    expect(() => scalingSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects crewPerOption with non-positive value', () => {
    const bad = {
      ...validBase,
      profiles: {
        '4': { exhaustion: 'light', crewPerOption: [0, 2], getawayBonus: 0.0 },
      },
    };
    expect(() => scalingSchema.parse(bad)).toThrow(ZodError);
  });

  it('accepts exhaustionRest tired=0 (rooms benched = 0 is valid)', () => {
    const result = scalingSchema.parse(validBase);
    expect(result.exhaustionRest.tired).toBe(0);
    expect(result.exhaustionRest.full).toBe(1);
    expect(result.exhaustionRest.light).toBe(1);
  });

  it('parses the default scaling.json without error', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'presets/default/scaling.json'), 'utf-8'));
    expect(() => scalingSchema.parse(raw)).not.toThrow();
  });

  it('parsed default scaling has exhaustionRest with expected values', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'presets/default/scaling.json'), 'utf-8'));
    const result = scalingSchema.parse(raw);
    expect(result.exhaustionRest.full).toBe(1);
    expect(result.exhaustionRest.light).toBe(1);
    expect(result.exhaustionRest.tired).toBe(0);
  });
});
