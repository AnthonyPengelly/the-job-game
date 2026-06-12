import { describe, it, expect } from 'vitest';
import { roomTemplatesSchema } from './room-templates';

import roomTemplatesJson from '../../../presets/default/content/roomTemplates.json';

const parsed = roomTemplatesSchema.parse(roomTemplatesJson);
const raw = roomTemplatesJson as unknown as Record<string, unknown>;

// ── Schema validation ─────────────────────────────────────────────────────────

describe('roomTemplates pack — schema', () => {
  it('parses without throwing', () => {
    expect(() => roomTemplatesSchema.parse(roomTemplatesJson)).not.toThrow();
  });

  it('has at least one obstacle template', () => {
    expect(parsed.obstacles.length).toBeGreaterThan(0);
  });

  it('every obstacle has a non-empty id, gameId, and lane', () => {
    for (const t of parsed.obstacles) {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.gameId.length).toBeGreaterThan(0);
      expect(['tech', 'physical', 'charm', 'stealth']).toContain(t.lane);
    }
  });

  it('every obstacle has exactly two options in [safe, greedy] order', () => {
    for (const t of parsed.obstacles) {
      expect(t.options).toHaveLength(2);
      expect(t.options[0]!.greedy).toBe(false);
      expect(t.options[1]!.greedy).toBe(true);
    }
  });

  it('all obstacle IDs are unique', () => {
    const ids = parsed.obstacles.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all option IDs are unique across all templates', () => {
    const ids = parsed.obstacles.flatMap(t => t.options.map(o => o.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reward values are non-negative integers', () => {
    for (const t of parsed.obstacles) {
      for (const o of t.options) {
        expect(Number.isInteger(o.reward)).toBe(true);
        expect(o.reward).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('safe reward ≤ greedy reward for each template (shape preserved)', () => {
    for (const t of parsed.obstacles) {
      expect(t.options[0]!.reward).toBeLessThanOrEqual(t.options[1]!.reward);
    }
  });
});

// ── Gear coverage ─────────────────────────────────────────────────────────────
// Wave 3: gear drops are rolled at generation for EVERY door — templates no
// longer carry gear hints; the schema rejects them.

describe('roomTemplates pack — no template-level gear (wave 3)', () => {
  it('no option carries a gear field', () => {
    for (const t of parsed.obstacles) {
      for (const o of t.options) {
        expect('gear' in o).toBe(false);
      }
    }
  });

  it('schema rejects an option with a gear hint (strict)', () => {
    const bad = JSON.parse(JSON.stringify(raw));
    bad.obstacles[0].options[0].gear = { kind: 'statBoost', lane: 'tech' };
    expect(roomTemplatesSchema.safeParse(bad).success).toBe(false);
  });
});

// ── Reward magnitudes ─────────────────────────────────────────────────────────

describe('roomTemplates pack — reward magnitudes', () => {
  const nonZeroRewards = parsed.obstacles
    .flatMap(t => t.options)
    .filter(o => o.reward > 0)
    .map(o => o.reward);

  it('all non-zero rewards are at least $10k (real-money scale)', () => {
    for (const r of nonZeroRewards) {
      expect(r).toBeGreaterThanOrEqual(10000);
    }
  });

  it('at least one reward reaches $40k or above', () => {
    expect(nonZeroRewards.some(r => r >= 40000)).toBe(true);
  });
});
