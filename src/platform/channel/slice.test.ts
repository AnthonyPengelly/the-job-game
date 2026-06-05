import { describe, it, expect } from 'vitest';
import { playerViewSliceSchema } from './slice';
import type { PlayerViewSlice } from './slice';

// ── idle slice ────────────────────────────────────────────────────────────────

describe('playerViewSliceSchema — idle', () => {
  it('validates a valid idle slice', () => {
    const result = playerViewSliceSchema.safeParse({ kind: 'idle' });
    expect(result.success).toBe(true);
  });

  it('rejects idle with extra unexpected kind', () => {
    const result = playerViewSliceSchema.safeParse({ kind: 'unknown-kind' });
    expect(result.success).toBe(false);
  });
});

// ── defuse-rulebook slice ─────────────────────────────────────────────────────

describe('playerViewSliceSchema — defuse-rulebook', () => {
  it('validates a valid defuse-rulebook slice', () => {
    const result = playerViewSliceSchema.safeParse({
      kind: 'defuse-rulebook',
      rules: ['Cut RED wires', 'Cut CIRCLE wires'],
      gameActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('validates a defuse-rulebook slice with gameActive false', () => {
    const result = playerViewSliceSchema.safeParse({
      kind: 'defuse-rulebook',
      rules: [],
      gameActive: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects defuse-rulebook missing rules', () => {
    const result = playerViewSliceSchema.safeParse({
      kind: 'defuse-rulebook',
      gameActive: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects defuse-rulebook missing gameActive', () => {
    const result = playerViewSliceSchema.safeParse({
      kind: 'defuse-rulebook',
      rules: ['Cut RED wires'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects defuse-rulebook with non-string rule', () => {
    const result = playerViewSliceSchema.safeParse({
      kind: 'defuse-rulebook',
      rules: [42],
      gameActive: true,
    });
    expect(result.success).toBe(false);
  });
});

// ── player-view isolation — GM-only fields are stripped ───────────────────────

describe('playerViewSliceSchema — isolation: GM-only fields stripped', () => {
  it('strips safeWireIds if accidentally included (not in type)', () => {
    const parsed = playerViewSliceSchema.parse({
      kind: 'defuse-rulebook',
      rules: ['Cut RED wires'],
      gameActive: true,
      safeWireIds: ['wire-0', 'wire-2'],
    });
    expect(parsed).not.toHaveProperty('safeWireIds');
  });

  it('strips wires (wire layout) if accidentally included', () => {
    const parsed = playerViewSliceSchema.parse({
      kind: 'defuse-rulebook',
      rules: ['Cut RED wires'],
      gameActive: true,
      wires: [{ id: 'wire-0', color: 'red', symbol: 'circle' }],
    });
    expect(parsed).not.toHaveProperty('wires');
  });

  it('stripped slice has exactly the expected keys', () => {
    const parsed = playerViewSliceSchema.parse({
      kind: 'defuse-rulebook',
      rules: ['Cut RED wires'],
      gameActive: true,
      safeWireIds: ['wire-0'],
      secretField: 'GM-only',
    }) as Extract<PlayerViewSlice, { kind: 'defuse-rulebook' }>;
    expect(Object.keys(parsed).sort()).toEqual(['gameActive', 'kind', 'rules']);
  });
});
