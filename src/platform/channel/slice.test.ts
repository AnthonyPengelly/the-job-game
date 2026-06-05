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

// ── getaway slice ─────────────────────────────────────────────────────────────

describe('playerViewSliceSchema — getaway', () => {
  const validGetaway = {
    kind: 'getaway' as const,
    cardsCleared: 3,
    targetCards: 8,
    secondsRemaining: 45,
    clueGiverName: 'Alice',
    clueGiverIndex: 0,
    gameActive: true,
  };

  it('validates a valid getaway slice', () => {
    const result = playerViewSliceSchema.safeParse(validGetaway);
    expect(result.success).toBe(true);
  });

  it('validates with gameActive false', () => {
    const result = playerViewSliceSchema.safeParse({ ...validGetaway, gameActive: false });
    expect(result.success).toBe(true);
  });

  it('validates with cardsCleared 0', () => {
    const result = playerViewSliceSchema.safeParse({ ...validGetaway, cardsCleared: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects negative cardsCleared', () => {
    const result = playerViewSliceSchema.safeParse({ ...validGetaway, cardsCleared: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects zero targetCards', () => {
    const result = playerViewSliceSchema.safeParse({ ...validGetaway, targetCards: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative secondsRemaining', () => {
    const result = playerViewSliceSchema.safeParse({ ...validGetaway, secondsRemaining: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects missing clueGiverName', () => {
    const result = playerViewSliceSchema.safeParse({
      kind: 'getaway',
      cardsCleared: validGetaway.cardsCleared,
      targetCards: validGetaway.targetCards,
      secondsRemaining: validGetaway.secondsRemaining,
      clueGiverIndex: validGetaway.clueGiverIndex,
      gameActive: validGetaway.gameActive,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing gameActive', () => {
    const result = playerViewSliceSchema.safeParse({
      kind: 'getaway',
      cardsCleared: validGetaway.cardsCleared,
      targetCards: validGetaway.targetCards,
      secondsRemaining: validGetaway.secondsRemaining,
      clueGiverName: validGetaway.clueGiverName,
      clueGiverIndex: validGetaway.clueGiverIndex,
    });
    expect(result.success).toBe(false);
  });

  it('strips GM-only fields (e.g. heat, odds) on parse', () => {
    const parsed = playerViewSliceSchema.parse({
      ...validGetaway,
      heat: 12,
      getawayOdds: 0.42,
      secretField: 'GM-only',
    });
    expect(parsed).not.toHaveProperty('heat');
    expect(parsed).not.toHaveProperty('getawayOdds');
    expect(parsed).not.toHaveProperty('secretField');
  });

  it('stripped getaway slice has exactly the expected keys', () => {
    const parsed = playerViewSliceSchema.parse({
      ...validGetaway,
      heat: 12,
    }) as Extract<PlayerViewSlice, { kind: 'getaway' }>;
    expect(Object.keys(parsed).sort()).toEqual([
      'cardsCleared',
      'clueGiverIndex',
      'clueGiverName',
      'gameActive',
      'kind',
      'secondsRemaining',
      'targetCards',
    ]);
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
