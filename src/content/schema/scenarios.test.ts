import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { scenariosSchema } from './scenarios';
import { generateRoom } from '@/engine/generation';
import { initialState } from '@/engine/run';
import type { EngineConfig } from '@/engine/config';
import type { GearGrantDescriptor } from '@/engine/types';

import scenariosJson from '../../../presets/default/content/scenarios.json';
import gearJson from '../../../presets/default/content/gear.json';

// ── Parse the real scenarios pack ─────────────────────────────────────────────

const parsed = scenariosSchema.parse(scenariosJson);

// ── Count ─────────────────────────────────────────────────────────────────────

describe('scenarios pack — count', () => {
  it('contains exactly 44 scenarios', () => {
    expect(parsed.items).toHaveLength(44);
  });

  it('has unique IDs across all scenarios', () => {
    const ids = parsed.items.map(s => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ── Schema validation ─────────────────────────────────────────────────────────

describe('scenarios pack — schema', () => {
  it('parses without throwing', () => {
    expect(() => scenariosSchema.parse(scenariosJson)).not.toThrow();
  });

  it('every scenario has a non-empty id and setup', () => {
    for (const s of parsed.items) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.setup.length).toBeGreaterThan(0);
    }
  });

  it('every scenario has exactly two choices', () => {
    for (const s of parsed.items) {
      expect(s.choices).toHaveLength(2);
    }
  });

  it('every choice has a non-empty id and label', () => {
    for (const s of parsed.items) {
      for (const c of s.choices) {
        expect(c.id.length).toBeGreaterThan(0);
        expect(c.label.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── Roll choices ──────────────────────────────────────────────────────────────

describe('scenarios pack — roll choices', () => {
  const validLanes = new Set(['tech', 'physical', 'charm', 'stealth']);
  const allChoices = parsed.items.flatMap(s => s.choices);
  const rollChoices = allChoices.filter(c => 'roll' in c && c.roll !== undefined);

  it('at least one roll choice exists in the pack', () => {
    expect(rollChoices.length).toBeGreaterThan(0);
  });

  it('every roll choice has a valid lane', () => {
    for (const c of rollChoices) {
      if ('roll' in c && c.roll) {
        expect(validLanes).toContain(c.roll.lane);
      }
    }
  });

  it('every roll choice has an integer baseDifficulty in [1, 20]', () => {
    for (const c of rollChoices) {
      if ('roll' in c && c.roll) {
        const bd = c.roll.baseDifficulty;
        expect(Number.isInteger(bd)).toBe(true);
        expect(bd).toBeGreaterThanOrEqual(1);
        expect(bd).toBeLessThanOrEqual(20);
      }
    }
  });

  it('every roll choice baseDifficulty is in the target band [11, 16]', () => {
    for (const c of rollChoices) {
      if ('roll' in c && c.roll) {
        expect(c.roll.baseDifficulty).toBeGreaterThanOrEqual(11);
        expect(c.roll.baseDifficulty).toBeLessThanOrEqual(16);
      }
    }
  });
});

// ── Gear descriptor resolution ────────────────────────────────────────────────

describe('scenarios pack — gear descriptors', () => {
  const validLanes = new Set(['tech', 'physical', 'charm', 'stealth']);
  const gearCatalogIds = new Set(gearJson.items.map(g => g.id));

  function collectGearDescriptors(effect: Record<string, unknown>): GearGrantDescriptor[] {
    const results: GearGrantDescriptor[] = [];
    if (effect.gear) {
      results.push(effect.gear as GearGrantDescriptor);
    }
    if (effect.delayed && typeof effect.delayed === 'object') {
      const delayed = effect.delayed as Record<string, unknown>;
      if (delayed.payoff && typeof delayed.payoff === 'object') {
        results.push(...collectGearDescriptors(delayed.payoff as Record<string, unknown>));
      }
    }
    return results;
  }

  function allEffectsForScenario(scenario: (typeof parsed.items)[number]): Record<string, unknown>[] {
    const effects: Record<string, unknown>[] = [];
    for (const choice of scenario.choices) {
      if ('effect' in choice && choice.effect) {
        effects.push(choice.effect as Record<string, unknown>);
      }
      if ('roll' in choice && choice.roll) {
        effects.push(choice.roll.success as Record<string, unknown>);
        effects.push(choice.roll.failure as Record<string, unknown>);
      }
    }
    return effects;
  }

  it('all single-lane gear descriptors resolve to a real catalogue ID', () => {
    for (const s of parsed.items) {
      for (const effect of allEffectsForScenario(s)) {
        for (const desc of collectGearDescriptors(effect)) {
          if (desc.lane !== undefined) {
            expect(validLanes).toContain(desc.lane);
            // Find a matching gear in the catalog
            const match = gearJson.items.find(g => {
              if (g.lane !== desc.lane) return false;
              if (desc.kind === 'bigScore') return g.kind === 'statBoost' && (g as { magnitude?: number }).magnitude === 2;
              if (desc.kind === 'statBoost') return g.kind === 'statBoost' && (g as { magnitude?: number }).magnitude === 1;
              return g.kind === desc.kind;
            });
            expect(match, `no catalog gear for descriptor ${JSON.stringify(desc)} in scenario ${s.id}`).toBeDefined();
          }
        }
      }
    }
  });

  it('all multi-lane gear descriptors reference only valid lanes', () => {
    for (const s of parsed.items) {
      for (const effect of allEffectsForScenario(s)) {
        for (const desc of collectGearDescriptors(effect)) {
          if (desc.lanes !== undefined) {
            for (const lane of desc.lanes) {
              expect(validLanes, `invalid lane "${lane}" in descriptor for scenario ${s.id}`).toContain(lane);
            }
          }
        }
      }
    }
  });

  it('every catalogue gear ID referenced by single-lane descriptors exists', () => {
    for (const s of parsed.items) {
      for (const effect of allEffectsForScenario(s)) {
        for (const desc of collectGearDescriptors(effect)) {
          if (desc.lane !== undefined) {
            const kind = desc.kind === 'bigScore' ? 'statBoost' : desc.kind;
            const magnitude = desc.kind === 'bigScore' ? 2 : desc.kind === 'statBoost' ? 1 : undefined;
            const match = gearJson.items.find(g => {
              if (g.kind !== kind || g.lane !== desc.lane) return false;
              if (magnitude !== undefined) return (g as { magnitude?: number }).magnitude === magnitude;
              return true;
            });
            expect(gearCatalogIds.has(match?.id ?? ''), `gear not in catalog for ${JSON.stringify(desc)}`).toBe(true);
          }
        }
      }
    }
  });
});

// ── Malformed input ───────────────────────────────────────────────────────────

describe('scenarios schema — malformed input', () => {
  it('throws ZodError when pack is missing _meta', () => {
    expect(() => scenariosSchema.parse({ items: [] })).toThrow(ZodError);
  });

  it('throws ZodError when items is empty', () => {
    expect(() =>
      scenariosSchema.parse({
        _meta: { pack: 'scenarios', version: 1, source: 'test' },
        items: [],
      }),
    ).toThrow(ZodError);
  });

  it('throws ZodError when a choice has neither effect nor roll', () => {
    expect(() =>
      scenariosSchema.parse({
        _meta: { pack: 'scenarios', version: 1, source: 'test' },
        items: [
          {
            id: 'bad',
            setup: 'Bad scenario',
            choices: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B', effect: { heatDelta: 0, lootDelta: 0 } },
            ],
          },
        ],
      }),
    ).toThrow(ZodError);
  });

  it('throws ZodError when a roll choice has an invalid lane', () => {
    expect(() =>
      scenariosSchema.parse({
        _meta: { pack: 'scenarios', version: 1, source: 'test' },
        items: [
          {
            id: 'bad-lane',
            setup: 'A scenario',
            choices: [
              {
                id: 'a',
                label: 'A',
                roll: {
                  lane: 'luck',
                  baseDifficulty: 13,
                  success: { heatDelta: 0, lootDelta: 0 },
                  failure: { heatDelta: 2, lootDelta: 0 },
                },
              },
              { id: 'b', label: 'B', effect: { heatDelta: 0, lootDelta: 0 } },
            ],
          },
        ],
      }),
    ).toThrow(ZodError);
  });

  it('throws ZodError when a gear descriptor lacks both lane and lanes', () => {
    expect(() =>
      scenariosSchema.parse({
        _meta: { pack: 'scenarios', version: 1, source: 'test' },
        items: [
          {
            id: 'bad-gear',
            setup: 'A scenario',
            choices: [
              {
                id: 'a',
                label: 'A',
                effect: { heatDelta: 0, lootDelta: 0, gear: { kind: 'powerUp' } },
              },
              { id: 'b', label: 'B', effect: { heatDelta: 0, lootDelta: 0 } },
            ],
          },
        ],
      }),
    ).toThrow(ZodError);
  });
});

// ── No-repeat draw over a long run ────────────────────────────────────────────

describe('scenarios pack — no-repeat draw within the run', () => {
  // Build a minimal EngineConfig wired to the real 44-scenario pack.
  const cfg: EngineConfig = {
    heat: { hMax: 20, runAtFraction: 0.55 },
    escalation: { onsetRoom: 5, rampPerObstacle: 0.2 },
    obstacleHeat: { safe: 1, greedy: 2, greedyBelowFraction: 0.5 },
    outcomeHeat: { clean: 0, complication: 1, botched: 2 },
    outcomeLoot: { complication: 1, botched: 0 },
    scenarioSwing: { small: 2, big: 4 },
    getaway: {
      exponent: 1.3, skillTerm: 0.5, skillPivot: 0.65, headcountTerm: 0.8,
      clamp: [0.04, 0.97] as [number, number],
      brief: {
        lowHeat:  { heat: 0,  targetCards: 5,  timerSeconds: 90 },
        highHeat: { heat: 20, targetCards: 12, timerSeconds: 45 },
      },
      ditchHeatCost: 2,
      buySecondsBonus: 20,
    },
    scoring: { winBaseMultiplier: 1.0, lowHeatStyleBonus: 0.5, bustMultiplier: 0.4 },
    scaling: {
      profiles: { '4': { getawayBonus: 0.0, crewPerOption: [1, 2] as [number, number], exhaustion: 'light' as const } },
      exhaustionRest: { full: 1, light: 1, tired: 0 },
      minCommit: { obs: 1 },
      variant: {},
      excludedFromSolo: [],
      soloEligibleMinPool: 8,
      dialCurve: { _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 } },
    },
    // Force all rooms to be scenario rooms for this test.
    generation: { obstacleRatio: 0.0 },
    scenario: { dcClamp: [1, 20] as [number, number], easeDialSteps: 1, critFumble: false },
    gear: {},
    banks: { categories: [], trivia: [] },
    roomTemplates: {
      obstacles: [
        {
          id: 'obs-stub',
          gameId: 'obs',
          lane: 'tech',
          options: [
            { id: 'obs-safe',   greedy: false, heatCost: 1, reward: 1 },
            { id: 'obs-greedy', greedy: true,  heatCost: 2, reward: 2 },
          ],
        },
      ],
      // Use the real 44 scenario defs.
      scenarios: parsed.items as unknown as EngineConfig['roomTemplates']['scenarios'],
    },
  };

  it('draws all 44 scenarios before any repeats within the run', () => {
    const seen = new Set<string>();
    let state = initialState(42);
    let iterations = 0;
    const maxIterations = 44 * 5;

    while (seen.size < 44 && iterations < maxIterations) {
      const next = generateRoom(state, cfg);
      state = { ...state, ...next, roomIndex: state.roomIndex + 1 };
      if (next.currentRoom?.kind === 'scenario') {
        const tid = next.currentRoom.templateId;
        // Within the first 44 draws, no ID should repeat.
        if (seen.size < 44) {
          expect(seen, `scenario ${tid} repeated before pool exhausted`).not.toContain(tid);
          seen.add(tid);
        }
      }
      iterations++;
    }

    expect(seen.size).toBe(44);
  });

  it('scenario templateIds all appear in the 44-scenario pack', () => {
    const validIds = new Set(parsed.items.map(s => s.id));
    let state = initialState(99);
    const observed = new Set<string>();

    for (let i = 0; i < 200 && observed.size < 44; i++) {
      const next = generateRoom(state, cfg);
      state = { ...state, ...next, roomIndex: state.roomIndex + 1 };
      if (next.currentRoom?.kind === 'scenario') {
        observed.add(next.currentRoom.templateId);
        expect(validIds).toContain(next.currentRoom.templateId);
      }
    }
  });
});
