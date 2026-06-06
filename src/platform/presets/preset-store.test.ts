import { describe, it, expect } from 'vitest';
import type { StorageLike } from '@/platform/persistence/save';
import type { UserPreset } from '@/content/schema/user-preset';
import { tuningSchema } from '@/content/schema';
import {
  listPresets,
  readPreset,
  writePreset,
  deletePreset,
  clonePreset,
  buildConfigFromPreset,
} from './preset-store';

import tuningJson from '../../../presets/default/tuning.json';

// Parsed once via Zod so TypeScript knows the exact types (e.g. clamp is [number, number]).
const defaultTuning = tuningSchema.parse(tuningJson);

// ── In-memory storage stub ───────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUserPreset(overrides: Partial<UserPreset> = {}): UserPreset {
  return {
    id: 'test-preset-1',
    name: 'Test Preset',
    baseId: 'default',
    tuning: defaultTuning,
    ...overrides,
  };
}

// ── listPresets ───────────────────────────────────────────────────────────────

describe('listPresets', () => {
  it('always includes the built-in default as the first entry', () => {
    const storage = makeStorage();
    const list = listPresets(storage);
    expect(list[0]).toEqual({ id: 'default', name: 'Default', isBuiltIn: true });
  });

  it('returns only default when no user presets exist', () => {
    const storage = makeStorage();
    expect(listPresets(storage)).toHaveLength(1);
  });

  it('includes user presets added via writePreset', () => {
    const storage = makeStorage();
    writePreset(makeUserPreset({ id: 'p1', name: 'My Preset' }), storage);
    const list = listPresets(storage);
    expect(list).toHaveLength(2);
    expect(list[1]).toEqual({ id: 'p1', name: 'My Preset', isBuiltIn: false });
  });

  it('default remains after writing a user preset', () => {
    const storage = makeStorage();
    writePreset(makeUserPreset({ id: 'p2' }), storage);
    const list = listPresets(storage);
    const defaultEntry = list.find(e => e.id === 'default');
    expect(defaultEntry).toBeDefined();
    expect(defaultEntry?.isBuiltIn).toBe(true);
  });
});

// ── writePreset / readPreset / deletePreset round-trip ────────────────────────

describe('writePreset / readPreset / deletePreset', () => {
  it('round-trips a user preset', () => {
    const storage = makeStorage();
    const p = makeUserPreset({ id: 'round-trip', name: 'Round Trip' });
    writePreset(p, storage);
    const read = readPreset('round-trip', storage);
    expect(read).not.toBeNull();
    expect(read?.id).toBe('round-trip');
    expect(read?.name).toBe('Round Trip');
    expect(read?.baseId).toBe('default');
  });

  it('readPreset returns null for an unknown id', () => {
    const storage = makeStorage();
    expect(readPreset('does-not-exist', storage)).toBeNull();
  });

  it('readPreset("default") returns a preset with the bundled tuning', () => {
    const storage = makeStorage();
    const defaultPreset = readPreset('default', storage);
    expect(defaultPreset).not.toBeNull();
    expect(defaultPreset?.id).toBe('default');
    expect(defaultPreset?.tuning.heat.hMax).toBe(20);
  });

  it('deletePreset removes the preset from the list', () => {
    const storage = makeStorage();
    writePreset(makeUserPreset({ id: 'to-delete' }), storage);
    expect(listPresets(storage)).toHaveLength(2);
    deletePreset('to-delete', storage);
    expect(listPresets(storage)).toHaveLength(1);
    expect(readPreset('to-delete', storage)).toBeNull();
  });

  it('writePreset cannot overwrite the default preset', () => {
    const storage = makeStorage();
    writePreset(makeUserPreset({ id: 'default', name: 'Sneaky Override' }), storage);
    // default should still be returned from the built-in bundle, not the stored one
    const defaultPreset = readPreset('default', storage);
    expect(defaultPreset?.name).toBe('Default');
  });

  it('deletePreset on the default is a no-op', () => {
    const storage = makeStorage();
    deletePreset('default', storage);
    const list = listPresets(storage);
    expect(list.some(e => e.id === 'default')).toBe(true);
  });
});

// ── clonePreset ───────────────────────────────────────────────────────────────

describe('clonePreset', () => {
  it('clone from default produces a new preset with a different id', () => {
    const storage = makeStorage();
    const clone = clonePreset('default', 'My Clone', storage);
    expect(clone.id).not.toBe('default');
    expect(clone.name).toBe('My Clone');
    expect(clone.baseId).toBe('default');
  });

  it('clone appears in listPresets', () => {
    const storage = makeStorage();
    clonePreset('default', 'Listed Clone', storage);
    const list = listPresets(storage);
    expect(list.some(e => e.name === 'Listed Clone')).toBe(true);
  });

  it('clone from a user preset produces an independent copy', () => {
    const storage = makeStorage();
    const source = makeUserPreset({ id: 'src', name: 'Source' });
    writePreset(source, storage);
    const clone = clonePreset('src', 'Clone of Source', storage);
    expect(clone.id).not.toBe('src');
    expect(clone.name).toBe('Clone of Source');
  });

  it('two clones from the same source get distinct ids', () => {
    const storage = makeStorage();
    const c1 = clonePreset('default', 'Clone A', storage);
    const c2 = clonePreset('default', 'Clone B', storage);
    expect(c1.id).not.toBe(c2.id);
  });

  it('editing the clone tuning does not affect the source', () => {
    const storage = makeStorage();
    writePreset(makeUserPreset({ id: 'original' }), storage);
    const clone = clonePreset('original', 'Cloned', storage);

    // Mutate the clone's tuning in memory — this simulates a panel edit
    const mutated: UserPreset = {
      ...clone,
      tuning: { ...clone.tuning, heat: { ...clone.tuning.heat, hMax: 99 } },
    };
    writePreset(mutated, storage);

    // Original should be unchanged
    const rereadOriginal = readPreset('original', storage);
    expect(rereadOriginal?.tuning.heat.hMax).toBe(20);
  });

  it('throws when the source preset is not found', () => {
    const storage = makeStorage();
    expect(() => clonePreset('nonexistent', 'Fail', storage)).toThrow();
  });
});

// ── buildConfigFromPreset ─────────────────────────────────────────────────────

describe('buildConfigFromPreset', () => {
  it('returns ok:true with a frozen EngineConfig for "default"', () => {
    const storage = makeStorage();
    const result = buildConfigFromPreset('default', storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.cfg)).toBe(true);
      expect(result.cfg.heat.hMax).toBe(20);
    }
  });

  it('returns ok:true for a valid user preset', () => {
    const storage = makeStorage();
    const clone = clonePreset('default', 'Valid Clone', storage);
    const result = buildConfigFromPreset(clone.id, storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cfg.heat.hMax).toBe(20);
    }
  });

  it('returns ok:false with a field-naming error for runAtFraction=1.5 (out of range)', () => {
    const storage = makeStorage();
    const clone = clonePreset('default', 'Bad Tuning', storage);
    const bad: UserPreset = {
      ...clone,
      tuning: {
        ...clone.tuning,
        heat: { ...clone.tuning.heat, runAtFraction: 1.5 },
      },
    };
    writePreset(bad, storage);

    const result = buildConfigFromPreset(bad.id, storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('runAtFraction');
    }
  });

  it('returns ok:false with a field-naming error for negative ramp', () => {
    const storage = makeStorage();
    const clone = clonePreset('default', 'Negative Ramp', storage);
    const bad: UserPreset = {
      ...clone,
      tuning: {
        ...clone.tuning,
        escalation: { ...clone.tuning.escalation, rampPerObstacle: -1 },
      },
    };
    writePreset(bad, storage);

    const result = buildConfigFromPreset(bad.id, storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('rampPerObstacle');
      expect(result.path).toContain('rampPerObstacle');
    }
  });

  it('returns ok:false with a message for an unknown preset id', () => {
    const storage = makeStorage();
    const result = buildConfigFromPreset('unknown-id', storage);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('unknown-id');
    }
  });

  it('never throws — invalid input always returns ok:false', () => {
    const storage = makeStorage();
    expect(() => buildConfigFromPreset('no-such-id', storage)).not.toThrow();
  });

  it('ok:false result has no cfg property', () => {
    const storage = makeStorage();
    const result = buildConfigFromPreset('missing', storage);
    expect(result.ok).toBe(false);
    expect('cfg' in result).toBe(false);
  });
});
