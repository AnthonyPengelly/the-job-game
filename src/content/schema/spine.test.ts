import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { markSpineSchema, spineBankSchema } from './spine';
import spineJson from '../../../presets/default/content/spine.json';

// ── Valid fixture ─────────────────────────────────────────────────────────────

const validMark = {
  id: 'villa-test',
  mansionType: 'villa',
  markName: 'Ashcombe House',
  vault: 'East Wing, Ground Floor',
  security: 'MODERATE',
  targetHaul: '$85k',
  dropCaption: 'A hillside villa with a locked east wing.',
  dressing: 'Manicured grounds, one night guard on rotation.',
};

const validBank = {
  marks: [
    { ...validMark, id: 'villa-test-1', mansionType: 'villa' },
    { ...validMark, id: 'estate-test-1', mansionType: 'estate' },
    { ...validMark, id: 'penthouse-test-1', mansionType: 'penthouse' },
  ],
};

// ── markSpineSchema — valid ───────────────────────────────────────────────────

describe('markSpineSchema — valid', () => {
  it('parses a valid MarkSpine without throwing', () => {
    expect(() => markSpineSchema.parse(validMark)).not.toThrow();
  });

  it('parses all three mansionTypes', () => {
    for (const mansionType of ['villa', 'estate', 'penthouse'] as const) {
      expect(() => markSpineSchema.parse({ ...validMark, id: mansionType, mansionType })).not.toThrow();
    }
  });

  it('returns the correct field values', () => {
    const parsed = markSpineSchema.parse(validMark);
    expect(parsed.markName).toBe('Ashcombe House');
    expect(parsed.vault).toBe('East Wing, Ground Floor');
    expect(parsed.security).toBe('MODERATE');
    expect(parsed.targetHaul).toBe('$85k');
    expect(parsed.mansionType).toBe('villa');
  });
});

// ── markSpineSchema — invalid ─────────────────────────────────────────────────

describe('markSpineSchema — invalid', () => {
  it('rejects an unknown mansionType', () => {
    expect(() => markSpineSchema.parse({ ...validMark, mansionType: 'bunker' })).toThrow(ZodError);
  });

  it('rejects a missing required field (markName)', () => {
    const { markName: _omit, ...noMarkName } = validMark;
    void _omit;
    expect(() => markSpineSchema.parse(noMarkName)).toThrow(ZodError);
  });

  it('rejects an empty string for id', () => {
    expect(() => markSpineSchema.parse({ ...validMark, id: '' })).toThrow(ZodError);
  });

  it('rejects an unknown extra field (.strict())', () => {
    expect(() => markSpineSchema.parse({ ...validMark, extraField: 'oops' })).toThrow(ZodError);
  });
});

// ── spineBankSchema — valid ───────────────────────────────────────────────────

describe('spineBankSchema — valid', () => {
  it('parses a valid SpineBank without throwing', () => {
    expect(() => spineBankSchema.parse(validBank)).not.toThrow();
  });

  it('returns marks as an array', () => {
    const parsed = spineBankSchema.parse(validBank);
    expect(Array.isArray(parsed.marks)).toBe(true);
    expect(parsed.marks).toHaveLength(3);
  });
});

// ── spineBankSchema — duplicate ids ──────────────────────────────────────────

describe('spineBankSchema — duplicate mark ids', () => {
  it('rejects a bank with duplicate mark ids', () => {
    const bad = {
      marks: [
        { ...validMark, id: 'dup' },
        { ...validMark, id: 'dup', mansionType: 'estate' },
      ],
    };
    expect(() => spineBankSchema.parse(bad)).toThrow(ZodError);
  });

  it('allows the same markName in different entries (only id must be unique)', () => {
    const ok = {
      marks: [
        { ...validMark, id: 'a', mansionType: 'villa' },
        { ...validMark, id: 'b', mansionType: 'estate' },
      ],
    };
    expect(() => spineBankSchema.parse(ok)).not.toThrow();
  });
});

// ── spineBankSchema — malformed ───────────────────────────────────────────────

describe('spineBankSchema — malformed fixture', () => {
  it('rejects when marks is a string instead of an array', () => {
    expect(() => spineBankSchema.parse({ marks: 'not-an-array' })).toThrow(ZodError);
  });

  it('rejects an unknown top-level key (.strict())', () => {
    expect(() => spineBankSchema.parse({ ...validBank, extra: 'oops' })).toThrow(ZodError);
  });
});

// ── Default spine.json parses ─────────────────────────────────────────────────

describe('default spine.json', () => {
  it('parses without throwing', () => {
    expect(() => spineBankSchema.parse(spineJson)).not.toThrow();
  });

  it('has ≥3 marks per mansionType', () => {
    const bank = spineBankSchema.parse(spineJson);
    for (const mt of ['villa', 'estate', 'penthouse'] as const) {
      const count = bank.marks.filter((m) => m.mansionType === mt).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('all mark ids are unique', () => {
    const bank = spineBankSchema.parse(spineJson);
    const ids = bank.marks.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
