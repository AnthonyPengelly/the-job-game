import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { quirksSchema } from './quirks';

const validMeta = { pack: 'quirks' as const, version: 1, source: 'test' };

describe('quirksSchema', () => {
  describe('valid quirks', () => {
    it('accepts a single-lane +2 quirk', () => {
      const result = quirksSchema.parse({
        _meta: validMeta,
        items: [{ id: 'circuit-jockey', name: 'Circuit Jockey', boosts: [{ lane: 'tech', magnitude: 2 }] }],
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.boosts[0]?.magnitude).toBe(2);
    });

    it('accepts a two-lane +1/+1 quirk with distinct lanes', () => {
      const result = quirksSchema.parse({
        _meta: validMeta,
        items: [
          {
            id: 'cat-burglar',
            name: 'Cat Burglar',
            boosts: [
              { lane: 'tech', magnitude: 1 },
              { lane: 'stealth', magnitude: 1 },
            ],
          },
        ],
      });
      expect(result.items[0]?.boosts).toHaveLength(2);
    });

    it('accepts all four single-lane variants', () => {
      const lanes = ['tech', 'physical', 'charm', 'stealth'] as const;
      for (const lane of lanes) {
        expect(() =>
          quirksSchema.parse({
            _meta: validMeta,
            items: [{ id: `quirk-${lane}`, name: `Name`, boosts: [{ lane, magnitude: 2 }] }],
          }),
        ).not.toThrow();
      }
    });

    it('parses the default quirks.json without errors', async () => {
      const raw = await import('../../../presets/default/content/quirks.json');
      const parsed = quirksSchema.parse(raw.default ?? raw);
      expect(parsed.items).toHaveLength(10);
    });
  });

  describe('invalid quirks — schema rejects malformed data', () => {
    it('rejects a single-lane quirk with magnitude !== 2', () => {
      expect(() =>
        quirksSchema.parse({
          _meta: validMeta,
          items: [{ id: 'bad', name: 'Bad', boosts: [{ lane: 'tech', magnitude: 1 }] }],
        }),
      ).toThrow(ZodError);
    });

    it('rejects a two-lane quirk where one magnitude is not 1', () => {
      expect(() =>
        quirksSchema.parse({
          _meta: validMeta,
          items: [
            {
              id: 'bad',
              name: 'Bad',
              boosts: [
                { lane: 'tech', magnitude: 2 },
                { lane: 'stealth', magnitude: 1 },
              ],
            },
          ],
        }),
      ).toThrow(ZodError);
    });

    it('rejects a two-lane quirk with duplicate lanes', () => {
      expect(() =>
        quirksSchema.parse({
          _meta: validMeta,
          items: [
            {
              id: 'bad',
              name: 'Bad',
              boosts: [
                { lane: 'tech', magnitude: 1 },
                { lane: 'tech', magnitude: 1 },
              ],
            },
          ],
        }),
      ).toThrow(ZodError);
    });

    it('rejects a quirk with an unknown lane', () => {
      expect(() =>
        quirksSchema.parse({
          _meta: validMeta,
          items: [{ id: 'bad', name: 'Bad', boosts: [{ lane: 'magic', magnitude: 2 }] }],
        }),
      ).toThrow(ZodError);
    });

    it('rejects an item missing the name field', () => {
      expect(() =>
        quirksSchema.parse({
          _meta: validMeta,
          items: [{ id: 'bad', boosts: [{ lane: 'tech', magnitude: 2 }] }],
        }),
      ).toThrow(ZodError);
    });

    it('rejects an empty boosts array', () => {
      expect(() =>
        quirksSchema.parse({
          _meta: validMeta,
          items: [{ id: 'bad', name: 'Bad', boosts: [] }],
        }),
      ).toThrow(ZodError);
    });

    it('rejects a wrong _meta.pack value', () => {
      expect(() =>
        quirksSchema.parse({
          _meta: { pack: 'gear', version: 1, source: 'test' },
          items: [],
        }),
      ).toThrow(ZodError);
    });
  });

  describe('default quirks.json content rules', () => {
    it('has exactly 4 single-lane (+2) quirks', async () => {
      const raw = await import('../../../presets/default/content/quirks.json');
      const parsed = quirksSchema.parse(raw.default ?? raw);
      const singleLane = parsed.items.filter(q => q.boosts.length === 1);
      expect(singleLane).toHaveLength(4);
    });

    it('has exactly 6 two-lane (+1/+1) quirks', async () => {
      const raw = await import('../../../presets/default/content/quirks.json');
      const parsed = quirksSchema.parse(raw.default ?? raw);
      const twoLane = parsed.items.filter(q => q.boosts.length === 2);
      expect(twoLane).toHaveLength(6);
    });

    it('covers all 6 distinct lane pairs in the two-lane quirks', async () => {
      const raw = await import('../../../presets/default/content/quirks.json');
      const parsed = quirksSchema.parse(raw.default ?? raw);
      const twoLane = parsed.items.filter(q => q.boosts.length === 2);
      const pairs = twoLane.map(q => [q.boosts[0]!.lane, q.boosts[1]!.lane].sort().join('+'));
      const lanes = ['tech', 'physical', 'charm', 'stealth'];
      const expectedPairs = new Set<string>();
      for (let i = 0; i < lanes.length; i++) {
        for (let j = i + 1; j < lanes.length; j++) {
          expectedPairs.add([lanes[i], lanes[j]].sort().join('+'));
        }
      }
      expect(new Set(pairs)).toEqual(expectedPairs);
    });

    it('has all single-lane quirks covering each lane exactly once', async () => {
      const raw = await import('../../../presets/default/content/quirks.json');
      const parsed = quirksSchema.parse(raw.default ?? raw);
      const singleLane = parsed.items.filter(q => q.boosts.length === 1);
      const coveredLanes = singleLane.map(q => q.boosts[0]!.lane).sort();
      expect(coveredLanes).toEqual(['charm', 'physical', 'stealth', 'tech']);
    });

    it('all IDs are unique', async () => {
      const raw = await import('../../../presets/default/content/quirks.json');
      const parsed = quirksSchema.parse(raw.default ?? raw);
      const ids = parsed.items.map(q => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
