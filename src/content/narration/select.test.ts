import { describe, it, expect } from 'vitest';
import { filterByContext, selectVariant } from './select';
import type { NarrationVariant } from '@/content/schema/narration';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function v(id: string, when?: NarrationVariant['when']): NarrationVariant {
  return { id, text: `Text for ${id}`, when };
}

const unconditional = v('u1');
const villaOnly = v('villa', { mansionType: 'villa' });
const estateOnly = v('estate', { mansionType: 'estate' });
const greedyOnly = v('greedy', { greedy: true });
const safeOnly = v('safe', { greedy: false });
const hotBand = v('hot', { heatBand: 'hot' });
const cleanOutcome = v('clean', { outcome: 'clean' });
const safeCrackGame = v('sc', { gameId: 'safeCrack' });
const techLane = v('tech', { lane: 'tech' });

// ── filterByContext ───────────────────────────────────────────────────────────

describe('filterByContext', () => {
  it('returns all variants when ctx is empty (no filter)', () => {
    const pool = [unconditional, villaOnly, estateOnly];
    const result = filterByContext(pool, {});
    expect(result).toEqual([unconditional]);
  });

  it('includes unconditional variants always', () => {
    const pool = [unconditional, villaOnly];
    const result = filterByContext(pool, { mansionType: 'estate' });
    expect(result).toContainEqual(unconditional);
    expect(result).not.toContainEqual(villaOnly);
  });

  it('includes a villa variant when ctx.mansionType is villa', () => {
    const pool = [unconditional, villaOnly, estateOnly];
    const result = filterByContext(pool, { mansionType: 'villa' });
    expect(result).toContainEqual(villaOnly);
    expect(result).not.toContainEqual(estateOnly);
  });

  it('excludes a villa variant for an estate context', () => {
    const pool = [villaOnly, estateOnly];
    const result = filterByContext(pool, { mansionType: 'estate' });
    expect(result).not.toContainEqual(villaOnly);
    expect(result).toContainEqual(estateOnly);
  });

  it('filters by greedy correctly', () => {
    const pool = [unconditional, greedyOnly, safeOnly];
    const greedy = filterByContext(pool, { greedy: true });
    expect(greedy).toContainEqual(unconditional);
    expect(greedy).toContainEqual(greedyOnly);
    expect(greedy).not.toContainEqual(safeOnly);

    const safe = filterByContext(pool, { greedy: false });
    expect(safe).toContainEqual(unconditional);
    expect(safe).not.toContainEqual(greedyOnly);
    expect(safe).toContainEqual(safeOnly);
  });

  it('filters by heatBand correctly', () => {
    const pool = [unconditional, hotBand];
    expect(filterByContext(pool, { heatBand: 'hot' })).toContainEqual(hotBand);
    expect(filterByContext(pool, { heatBand: 'cool' })).not.toContainEqual(hotBand);
  });

  it('filters by outcome correctly', () => {
    const pool = [unconditional, cleanOutcome];
    expect(filterByContext(pool, { outcome: 'clean' })).toContainEqual(cleanOutcome);
    expect(filterByContext(pool, { outcome: 'botched' })).not.toContainEqual(cleanOutcome);
  });

  it('filters by gameId correctly', () => {
    const pool = [unconditional, safeCrackGame];
    expect(filterByContext(pool, { gameId: 'safeCrack' })).toContainEqual(safeCrackGame);
    expect(filterByContext(pool, { gameId: 'beat16' })).not.toContainEqual(safeCrackGame);
  });

  it('filters by lane correctly', () => {
    const pool = [unconditional, techLane];
    expect(filterByContext(pool, { lane: 'tech' })).toContainEqual(techLane);
    expect(filterByContext(pool, { lane: 'charm' })).not.toContainEqual(techLane);
  });

  it('returns empty array when no variants match', () => {
    const result = filterByContext([villaOnly], { mansionType: 'estate' });
    expect(result).toHaveLength(0);
  });
});

// ── selectVariant ─────────────────────────────────────────────────────────────

describe('selectVariant', () => {
  it('returns undefined for an empty candidate list', () => {
    expect(selectVariant([], [], () => 0)).toBeUndefined();
  });

  it('is deterministic: same rand sequence returns the same variant', () => {
    const pool = [v('a'), v('b'), v('c'), v('d')];
    const calls = [0.1, 0.5, 0.9] as const;
    let i = 0;
    const rand = (): number => calls[i++ % calls.length] ?? 0;

    i = 0;
    const r1 = selectVariant(pool, [], rand);
    i = 0;
    const r2 = selectVariant(pool, [], rand);

    expect(r1?.id).toBe(r2?.id);
  });

  it('prefers variants not in recentIds when fresh candidates exist', () => {
    const pool = [v('a'), v('b'), v('c')];
    const recentIds = ['a', 'b'];
    // With only 'c' as fresh, any rand value should return 'c'.
    const result = selectVariant(pool, recentIds, () => 0.5);
    expect(result?.id).toBe('c');
  });

  it('never returns a recently-used id while a fresh candidate exists', () => {
    const pool = [v('a'), v('b'), v('c'), v('d')];
    const recentIds = ['a', 'b'];
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = selectVariant(pool, recentIds, () => i / 20);
      if (r) results.add(r.id);
    }
    expect(results.has('a')).toBe(false);
    expect(results.has('b')).toBe(false);
  });

  it('falls back to the full pool when all candidates are recent (pool exhausted)', () => {
    const pool = [v('a'), v('b')];
    const recentIds = ['a', 'b'];
    // No fresh candidates — should fall back and return something, never throw.
    const result = selectVariant(pool, recentIds, () => 0.3);
    expect(result).toBeDefined();
    expect(['a', 'b']).toContain(result?.id);
  });

  it('returns from all pool members over multiple calls when no recents', () => {
    const pool = [v('x'), v('y'), v('z')];
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const r = selectVariant(pool, [], () => i / 30);
      if (r) seen.add(r.id);
    }
    expect(seen.has('x')).toBe(true);
    expect(seen.has('y')).toBe(true);
    expect(seen.has('z')).toBe(true);
  });

  it('single-variant pool always returns that variant', () => {
    const pool = [v('only')];
    expect(selectVariant(pool, [], () => 0)?.id).toBe('only');
    expect(selectVariant(pool, [], () => 0.99)?.id).toBe('only');
    expect(selectVariant(pool, ['only'], () => 0.5)?.id).toBe('only');
  });

  it('deterministic under a fixed sequence from a mulberry32-style counter', () => {
    const pool = [v('a'), v('b'), v('c'), v('d'), v('e')];
    // Simulate a fixed linear rand stream: values 0.0, 0.2, 0.4, 0.6, 0.8
    const values = [0.0, 0.2, 0.4, 0.6, 0.8] as const;
    let idx = 0;
    const rand = (): number => values[idx++ % values.length] ?? 0;

    idx = 0;
    const seq1 = Array.from({ length: 5 }, () => selectVariant(pool, [], rand)?.id);
    idx = 0;
    const seq2 = Array.from({ length: 5 }, () => selectVariant(pool, [], rand)?.id);

    expect(seq1).toEqual(seq2);
  });
});
