/**
 * E5.10 — Epic-level acceptance gate for the mini-game registry.
 *
 * Proves the full E5 regression net in one place:
 *   1. All ten games + two variant modules are registered and resolvable.
 *   2. Every game's lanes/minCommit are consistent with presets/default/scaling.json.
 *   3. Every obstacle gameId in roomTemplates.json resolves to a registered game.
 *   4. Excluded-from-solo games never appear at a commit slot below minCommit 2.
 *   5. The solo-eligible pool stays ≥ soloEligibleMinPool (8).
 *   6. Crack the Tumblers loads its solo variant at commitSize=1.
 *   7. Assembly Line loads its negotiated-swap variant at commitSize=2.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadPreset } from '@/platform/presets/load';
import { buildRegistry, games, getGame } from '@/minigames/registry';
import { obstacleCommitRange, resolveGameVariant } from '@/engine/scaling';
import type { EngineConfig } from '@/engine/config';
import type { Lane } from '@/engine';

// ── Fixture ───────────────────────────────────────────────────────────────────

let cfg: EngineConfig;

beforeAll(() => {
  cfg = loadPreset('default');
});

// ── 1. All 12 game modules are registered ─────────────────────────────────────

const TEN_BASE_GAME_IDS = [
  'safeCrack',
  'crackTheTumblers',
  'beat16',
  'categories',
  'theOnceOver',
  'followTheCircuit',
  'insideKnowledge',
  'steadyHands',
  'assemblyLine',
  'defuseTheAlarm',
] as const;

const TWO_VARIANT_IDS = [
  'crackTheTumblersSolo',
  'assemblyLineNegotiated',
] as const;

const ALL_TWELVE_IDS = [...TEN_BASE_GAME_IDS, ...TWO_VARIANT_IDS] as const;

describe('All ten games + two variants are in buildRegistry', () => {
  it('buildRegistry returns all twelve entries', () => {
    const registry = buildRegistry(cfg);
    for (const id of ALL_TWELVE_IDS) {
      const found = registry.find(g => g.id === id);
      expect(found, `${id} missing from buildRegistry`).toBeDefined();
    }
  });

  it('buildRegistry has at least 12 entries', () => {
    expect(buildRegistry(cfg).length).toBeGreaterThanOrEqual(12);
  });
});

describe('Static games array includes the ten non-bank-bound games', () => {
  const STATIC_GAME_IDS = TEN_BASE_GAME_IDS.filter(
    id => id !== 'categories' && id !== 'insideKnowledge',
  );
  const STATIC_IDS_WITH_VARIANTS = [...STATIC_GAME_IDS, ...TWO_VARIANT_IDS] as const;

  it('static games array has 10 entries (bank-bound games are buildRegistry-only)', () => {
    expect(games.length).toBe(10);
  });

  for (const id of STATIC_IDS_WITH_VARIANTS) {
    it(`getGame('${id}') returns the game module`, () => {
      const g = getGame(id);
      expect(g, `${id} not found via getGame`).toBeDefined();
      expect(g!.id).toBe(id);
    });
  }

  it('getGame returns undefined for unknown id', () => {
    expect(getGame('no-such-game')).toBeUndefined();
  });
});

// ── 2. Lanes and minCommit agree with the default preset ─────────────────────

type GameSpec = {
  id: string;
  lanes: Lane[];
  moduleMinCommit: number; // the game module's own minCommit
  scalingMinCommit: number; // what scaling.json says for this obstacle
};

const GAME_SPECS: GameSpec[] = [
  { id: 'safeCrack',            lanes: ['tech', 'stealth'],    moduleMinCommit: 1, scalingMinCommit: 1 },
  { id: 'crackTheTumblers',     lanes: ['tech'],               moduleMinCommit: 2, scalingMinCommit: 1 },
  { id: 'crackTheTumblersSolo', lanes: ['tech'],               moduleMinCommit: 1, scalingMinCommit: 1 },
  { id: 'beat16',               lanes: ['physical'],           moduleMinCommit: 1, scalingMinCommit: 1 },
  { id: 'categories',           lanes: ['charm'],              moduleMinCommit: 1, scalingMinCommit: 1 },
  { id: 'theOnceOver',          lanes: ['stealth'],            moduleMinCommit: 1, scalingMinCommit: 1 },
  { id: 'followTheCircuit',     lanes: ['tech', 'physical'],   moduleMinCommit: 1, scalingMinCommit: 1 },
  { id: 'insideKnowledge',      lanes: ['tech', 'charm'],      moduleMinCommit: 1, scalingMinCommit: 1 },
  { id: 'steadyHands',          lanes: ['physical', 'stealth'],moduleMinCommit: 1, scalingMinCommit: 1 },
  { id: 'assemblyLine',         lanes: ['physical', 'charm'],  moduleMinCommit: 2, scalingMinCommit: 2 },
  { id: 'assemblyLineNegotiated',lanes: ['physical', 'charm'], moduleMinCommit: 2, scalingMinCommit: 2 },
  { id: 'defuseTheAlarm',       lanes: ['charm', 'stealth'],   moduleMinCommit: 2, scalingMinCommit: 2 },
];

describe('Lanes and minCommit are correct for every registered game', () => {
  for (const spec of GAME_SPECS) {
    it(`${spec.id}: lanes = ${JSON.stringify(spec.lanes)}`, () => {
      const registry = buildRegistry(cfg);
      const g = registry.find(r => r.id === spec.id);
      expect(g, `${spec.id} missing from registry`).toBeDefined();
      expect(g!.lanes).toEqual(spec.lanes);
    });

    it(`${spec.id}: module minCommit = ${spec.moduleMinCommit}`, () => {
      const registry = buildRegistry(cfg);
      const g = registry.find(r => r.id === spec.id);
      expect(g!.minCommit).toBe(spec.moduleMinCommit);
    });
  }

  it('every base game has module.minCommit >= scaling.json minCommit (never less restrictive)', () => {
    const registry = buildRegistry(cfg);
    for (const spec of GAME_SPECS) {
      const g = registry.find(r => r.id === spec.id);
      if (g === undefined) continue;
      if (cfg.scaling.minCommit[spec.id] === undefined) continue;
      expect(
        g.minCommit,
        `${spec.id}: module minCommit (${g.minCommit}) < scaling.json minCommit (${cfg.scaling.minCommit[spec.id]})`,
      ).toBeGreaterThanOrEqual(cfg.scaling.minCommit[spec.id]!);
    }
  });

  it('every game has at least one lane with a valid value', () => {
    const validLanes: Lane[] = ['tech', 'physical', 'charm', 'stealth'];
    const registry = buildRegistry(cfg);
    for (const g of registry) {
      expect(g.lanes.length, `${g.id} has no lanes`).toBeGreaterThan(0);
      for (const lane of g.lanes) {
        expect(validLanes, `${g.id} has invalid lane '${lane}'`).toContain(lane);
      }
    }
  });
});

// ── 3. Obstacle coverage: every roomTemplate gameId resolves to a registered game ──

describe('Every roomTemplate obstacle gameId resolves to a registered game', () => {
  it('all obstacle gameIds are in scaling.json.minCommit', () => {
    for (const obstacle of cfg.roomTemplates.obstacles) {
      expect(
        cfg.scaling.minCommit[obstacle.gameId],
        `obstacle ${obstacle.id} gameId '${obstacle.gameId}' not in scaling.minCommit`,
      ).toBeDefined();
    }
  });

  it('all obstacle gameIds resolve to a registered game at their minCommit floor', () => {
    const registry = buildRegistry(cfg);
    for (const obstacle of cfg.roomTemplates.obstacles) {
      const floor = cfg.scaling.minCommit[obstacle.gameId] ?? 1;
      // Resolve at the obstacle's floor — this may route to a variant
      const resolvedId = resolveGameVariant(obstacle.gameId, floor, floor + 1, cfg);
      const found = registry.find(g => g.id === resolvedId);
      expect(
        found,
        `obstacle ${obstacle.id}: resolvedId '${resolvedId}' (from '${obstacle.gameId}' at commit ${floor}) not in registry`,
      ).toBeDefined();
    }
  });

  it('all ten unique base gameIds from roomTemplates are present', () => {
    const gameIds = new Set(cfg.roomTemplates.obstacles.map(o => o.gameId));
    expect(gameIds.size).toBe(10);
  });

  it('every obstacle gameId is a key in the full registry', () => {
    const registry = buildRegistry(cfg);
    for (const obstacle of cfg.roomTemplates.obstacles) {
      const found = registry.find(g => g.id === obstacle.gameId);
      expect(
        found,
        `obstacle gameId '${obstacle.gameId}' not directly in registry`,
      ).toBeDefined();
    }
  });
});

// ── 4. Excluded-from-solo games never appear below minCommit 2 ────────────────

describe('Excluded-from-solo games never offered below minCommit 2', () => {
  const EXCLUDED = ['assemblyLine', 'defuseTheAlarm'] as const;

  it('scaling.json excludedFromSolo matches the expected two games', () => {
    expect(cfg.scaling.excludedFromSolo).toContain('assemblyLine');
    expect(cfg.scaling.excludedFromSolo).toContain('defuseTheAlarm');
    expect(cfg.scaling.excludedFromSolo.length).toBe(2);
  });

  for (const gameId of EXCLUDED) {
    it(`${gameId}: module.minCommit = 2`, () => {
      const g = getGame(gameId);
      expect(g!.minCommit).toBe(2);
    });

    it(`${gameId}: scaling.json.minCommit = 2`, () => {
      expect(cfg.scaling.minCommit[gameId]).toBe(2);
    });

    it(`${gameId}: obstacleCommitRange minCrew >= 2 for all headcounts 2..7`, () => {
      for (let n = 2; n <= 7; n++) {
        const [minCrew] = obstacleCommitRange(gameId, n, cfg);
        expect(
          minCrew,
          `${gameId} at headcount ${n}: minCrew ${minCrew} < 2 (excluded-from-solo invariant)`,
        ).toBeGreaterThanOrEqual(2);
      }
    });

    it(`${gameId}: resolveGameVariant returns base id (not a variant) at commitSize=1`, () => {
      // Even if someone tries to route to it solo, excluded games stay as themselves
      expect(resolveGameVariant(gameId, 1, 3, cfg)).toBe(gameId);
    });

    it(`${gameId}: has no soloVariantId`, () => {
      const g = getGame(gameId);
      expect(g!.soloVariantId).toBeUndefined();
    });
  }
});

// ── 5. Solo-eligible pool is ≥ soloEligibleMinPool ───────────────────────────

describe('Solo-eligible game pool is ≥ soloEligibleMinPool', () => {
  it('soloEligibleMinPool is 8 in the default preset', () => {
    expect(cfg.scaling.soloEligibleMinPool).toBe(8);
  });

  it('solo-eligible base games (not excluded, scaling.minCommit=1) count ≥ 8', () => {
    // Count base game ids in scaling.minCommit that: (a) have minCommit=1 and (b) are not excluded
    const excluded = new Set(cfg.scaling.excludedFromSolo);
    const soloEligible = Object.entries(cfg.scaling.minCommit).filter(
      ([id, mc]) => mc === 1 && !excluded.has(id),
    );
    // The design says 8 solo-eligible games (7 dial-only + crackTheTumblers via variant)
    expect(soloEligible.length).toBeGreaterThanOrEqual(cfg.scaling.soloEligibleMinPool);
  });

  it('all solo-eligible base games have a registered module at commitSize=1', () => {
    const excluded = new Set(cfg.scaling.excludedFromSolo);
    const registry = buildRegistry(cfg);
    for (const [id, mc] of Object.entries(cfg.scaling.minCommit)) {
      if (mc !== 1 || excluded.has(id)) continue;
      const resolvedId = resolveGameVariant(id, 1, 2, cfg);
      const found = registry.find(g => g.id === resolvedId);
      expect(
        found,
        `solo-eligible game '${id}' resolves to '${resolvedId}' which is not registered`,
      ).toBeDefined();
    }
  });
});

// ── 6. Crack the Tumblers loads its solo variant at commitSize=1 ──────────────

describe('Crack the Tumblers solo variant — resolveGameVariant', () => {
  it('resolveGameVariant returns crackTheTumblersSolo at commitSize=1', () => {
    expect(resolveGameVariant('crackTheTumblers', 1, 2, cfg)).toBe('crackTheTumblersSolo');
  });

  it('resolveGameVariant returns crackTheTumblers (base) at commitSize=2', () => {
    expect(resolveGameVariant('crackTheTumblers', 2, 3, cfg)).toBe('crackTheTumblers');
  });

  it('resolveGameVariant returns crackTheTumblers (base) at commitSize=3', () => {
    expect(resolveGameVariant('crackTheTumblers', 3, 4, cfg)).toBe('crackTheTumblers');
  });

  it('crackTheTumblers base game carries soloVariantId crackTheTumblersSolo', () => {
    const g = getGame('crackTheTumblers');
    expect(g!.soloVariantId).toBe('crackTheTumblersSolo');
  });

  it('crackTheTumblersSolo module has minCommit=1', () => {
    expect(getGame('crackTheTumblersSolo')!.minCommit).toBe(1);
  });

  it('crackTheTumblers base module has minCommit=2 (true game needs 2 players)', () => {
    expect(getGame('crackTheTumblers')!.minCommit).toBe(2);
  });
});

// ── 7. Assembly Line loads its negotiated-swap variant at commitSize=2 ────────

describe('Assembly Line negotiated-swap variant — resolveGameVariant', () => {
  it('resolveGameVariant returns assemblyLineNegotiated at commitSize=2', () => {
    expect(resolveGameVariant('assemblyLine', 2, 3, cfg)).toBe('assemblyLineNegotiated');
  });

  it('resolveGameVariant returns assemblyLine (full) at commitSize=3', () => {
    expect(resolveGameVariant('assemblyLine', 3, 4, cfg)).toBe('assemblyLine');
  });

  it('resolveGameVariant returns assemblyLine (full) at commitSize=4', () => {
    expect(resolveGameVariant('assemblyLine', 4, 5, cfg)).toBe('assemblyLine');
  });

  it('assemblyLine is in scaling.json.excludedFromSolo', () => {
    expect(cfg.scaling.excludedFromSolo).toContain('assemblyLine');
  });

  it('assemblyLineNegotiated module has minCommit=2', () => {
    expect(getGame('assemblyLineNegotiated')!.minCommit).toBe(2);
  });

  it('obstacleCommitRange for assemblyLine never produces minCrew < 2 for any headcount', () => {
    for (let n = 2; n <= 7; n++) {
      const [minCrew] = obstacleCommitRange('assemblyLine', n, cfg);
      expect(minCrew).toBeGreaterThanOrEqual(2);
    }
  });
});
