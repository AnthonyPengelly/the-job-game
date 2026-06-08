import { describe, it, expect } from 'vitest';
import { roomTemplatesSchema } from './room-templates';

import roomTemplatesJson from '../../../presets/default/content/roomTemplates.json';

const parsed = roomTemplatesSchema.parse(roomTemplatesJson);

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

describe('roomTemplates pack — gear coverage', () => {
  const templatesWithGear = parsed.obstacles.filter(t =>
    t.options.some(o => o.gear !== undefined),
  );

  it('a clear majority (>50%) of obstacle templates carry a gear descriptor', () => {
    const ratio = templatesWithGear.length / parsed.obstacles.length;
    expect(ratio).toBeGreaterThan(0.5);
  });

  it('at least one template has a Gear-only option (reward:0 + gear)', () => {
    const hasGearOnly = parsed.obstacles.some(t =>
      t.options.some(o => o.reward === 0 && o.gear !== undefined),
    );
    expect(hasGearOnly).toBe(true);
  });

  it('at least one template has a Loot+Gear option (reward>0 + gear)', () => {
    const hasLootPlusGear = parsed.obstacles.some(t =>
      t.options.some(o => o.reward > 0 && o.gear !== undefined),
    );
    expect(hasLootPlusGear).toBe(true);
  });

  it('at least one template has a Loot-only option (reward>0, no gear)', () => {
    const hasLootOnly = parsed.obstacles.some(t =>
      t.options.some(o => o.reward > 0 && o.gear === undefined),
    );
    expect(hasLootOnly).toBe(true);
  });

  it('gear descriptors specify lane or lanes (never both absent)', () => {
    for (const t of parsed.obstacles) {
      for (const o of t.options) {
        if (o.gear !== undefined) {
          const hasLane = o.gear.lane !== undefined || (o.gear.lanes !== undefined && o.gear.lanes.length > 0);
          expect(hasLane).toBe(true);
        }
      }
    }
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
