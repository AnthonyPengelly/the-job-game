import { describe, it, expect } from 'vitest';
import { obstacleCommitRange, resolveGameVariant, computeDial } from './scaling';
import type { EngineConfig } from './config';

// ─── Inline test config ──────────────────────────────────────────────────────

const cfg = {
  scaling: {
    profiles: {
      '2': { getawayBonus: -0.04, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '3': { getawayBonus: -0.02, crewPerOption: [1, 2] as [number, number], exhaustion: 'tired' as const },
      '4': { getawayBonus: 0.0,   crewPerOption: [1, 2] as [number, number], exhaustion: 'light' as const },
      '5': { getawayBonus: 0.02,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '6': { getawayBonus: 0.035, crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
      '7': { getawayBonus: 0.05,  crewPerOption: [2, 3] as [number, number], exhaustion: 'full' as const },
    },
    exhaustionRest: { full: 1, light: 1, tired: 0 },
    minCommit: {
      easyGame: 1,
      hardGame: 2,
      assemblyLine: 2,
      defuseTheAlarm: 2,
    },
    variant: {
      easyGame: { soloVariantId: 'easyGameSolo', appliesAt: [1] },
      hardGame: { variantId: 'hardGameNegotiated', appliesAt: [2] },
    },
    excludedFromSolo: ['assemblyLine', 'defuseTheAlarm'],
    soloEligibleMinPool: 8,
    dialCurve: { _default: { base: 1.0, perLanePoint: -0.15, tightenPerExtraCrew: 0.1 } },
  },
} satisfies Pick<EngineConfig, 'scaling'> as unknown as EngineConfig;

// ─── obstacleCommitRange ─────────────────────────────────────────────────────

describe('obstacleCommitRange', () => {
  it('n=2 (crewPerOption [1,2], minCommit 1): range [1,2]', () => {
    expect(obstacleCommitRange('easyGame', 2, cfg)).toEqual([1, 2]);
  });

  it('n=3 (crewPerOption [1,2], minCommit 1): range [1,2]', () => {
    expect(obstacleCommitRange('easyGame', 3, cfg)).toEqual([1, 2]);
  });

  it('n=4 (crewPerOption [1,2], minCommit 1): range [1,2]', () => {
    expect(obstacleCommitRange('easyGame', 4, cfg)).toEqual([1, 2]);
  });

  it('n=5 (crewPerOption [2,3], minCommit 1): range [2,3]', () => {
    expect(obstacleCommitRange('easyGame', 5, cfg)).toEqual([2, 3]);
  });

  it('n=6 (crewPerOption [2,3], minCommit 1): range [2,3]', () => {
    expect(obstacleCommitRange('easyGame', 6, cfg)).toEqual([2, 3]);
  });

  it('n=7 (crewPerOption [2,3], minCommit 1): range [2,3]', () => {
    expect(obstacleCommitRange('easyGame', 7, cfg)).toEqual([2, 3]);
  });

  it('minCommit floor overrides crewPerOption min when higher (n=2, minCommit 2)', () => {
    expect(obstacleCommitRange('hardGame', 2, cfg)).toEqual([2, 2]);
  });

  it('maxCrew is clamped to headcount (n=2, crewPerOption max=2): maxCrew=2', () => {
    const [, maxCrew] = obstacleCommitRange('easyGame', 2, cfg);
    expect(maxCrew).toBe(2);
  });

  it('maxCrew is clamped to headcount — n=3 with crewPerOption max=2: maxCrew=2', () => {
    const [, maxCrew] = obstacleCommitRange('easyGame', 3, cfg);
    expect(maxCrew).toBe(2);
  });

  it('1 ≤ minCrew ≤ maxCrew for all n=2..7', () => {
    for (let n = 2; n <= 7; n++) {
      const [minCrew, maxCrew] = obstacleCommitRange('easyGame', n, cfg);
      expect(minCrew).toBeGreaterThanOrEqual(1);
      expect(minCrew).toBeLessThanOrEqual(maxCrew);
      expect(maxCrew).toBeLessThanOrEqual(n);
    }
  });

  it('minCrew ≥ minCommit for all n=2..7', () => {
    for (let n = 2; n <= 7; n++) {
      const [minCrew] = obstacleCommitRange('hardGame', n, cfg);
      expect(minCrew).toBeGreaterThanOrEqual(2); // hardGame minCommit=2
    }
  });

  it('uses minCommit=1 as fallback for unknown game', () => {
    const [minCrew] = obstacleCommitRange('unknownGame', 4, cfg);
    expect(minCrew).toBeGreaterThanOrEqual(1);
  });
});

// ─── resolveGameVariant ──────────────────────────────────────────────────────

describe('resolveGameVariant', () => {
  it('returns the base gameId when no variant is registered', () => {
    expect(resolveGameVariant('someGame', 1, 3, cfg)).toBe('someGame');
  });

  it('returns soloVariantId when commitSize=1 and game has soloVariantId', () => {
    expect(resolveGameVariant('easyGame', 1, 3, cfg)).toBe('easyGameSolo');
  });

  it('returns base id for easyGame when commitSize=2 (not in appliesAt)', () => {
    expect(resolveGameVariant('easyGame', 2, 3, cfg)).toBe('easyGame');
  });

  it('returns variantId for hardGame when commitSize=2', () => {
    expect(resolveGameVariant('hardGame', 2, 4, cfg)).toBe('hardGameNegotiated');
  });

  it('returns base id for hardGame when commitSize=1 (not in appliesAt)', () => {
    expect(resolveGameVariant('hardGame', 1, 4, cfg)).toBe('hardGame');
  });

  it('excludedFromSolo game returns base id for commitSize=1', () => {
    expect(resolveGameVariant('assemblyLine', 1, 3, cfg)).toBe('assemblyLine');
  });

  it('excludedFromSolo game returns base id even when solo variant might exist', () => {
    expect(resolveGameVariant('defuseTheAlarm', 1, 3, cfg)).toBe('defuseTheAlarm');
  });

  it('excludedFromSolo game can still have a group variant at higher commit size', () => {
    // assemblyLine has no variant entry in cfg, so returns base
    expect(resolveGameVariant('assemblyLine', 2, 4, cfg)).toBe('assemblyLine');
  });

  it('returns base id when poolSize < soloEligibleMinPool (poolSize=7, threshold=8)', () => {
    expect(resolveGameVariant('easyGame', 1, 3, cfg, 7)).toBe('easyGame');
  });

  it('returns soloVariantId when poolSize ≥ soloEligibleMinPool (poolSize=8, threshold=8)', () => {
    expect(resolveGameVariant('easyGame', 1, 3, cfg, 8)).toBe('easyGameSolo');
  });

  it('soloEligibleMinPool check is skipped when poolSize is not provided', () => {
    // Without poolSize, solo is allowed (excludedFromSolo and appliesAt still checked)
    expect(resolveGameVariant('easyGame', 1, 3, cfg, undefined)).toBe('easyGameSolo');
  });

  it('returns base id when game has variant but appliesAt does not include commitSize', () => {
    // easyGame only applies at [1]; commitSize=3 → base
    expect(resolveGameVariant('easyGame', 3, 5, cfg)).toBe('easyGame');
  });
});

// ─── computeDial ─────────────────────────────────────────────────────────────

describe('computeDial', () => {
  it('returns base value when no ratings and 1 committed', () => {
    expect(computeDial([0], 'anyGame', 4, cfg)).toBeCloseTo(1.0);
  });

  it('strictly decreases as a committed lane rating rises', () => {
    const low  = computeDial([1], 'anyGame', 4, cfg);
    const mid  = computeDial([3], 'anyGame', 4, cfg);
    const high = computeDial([5], 'anyGame', 4, cfg);
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it('eases (decreases) with an extra committed crew member (same per-player rating)', () => {
    const one  = computeDial([2], 'anyGame', 4, cfg);
    const two  = computeDial([2, 2], 'anyGame', 4, cfg);
    const three = computeDial([2, 2, 2], 'anyGame', 4, cfg);
    expect(one).toBeGreaterThan(two);
    expect(two).toBeGreaterThan(three);
  });

  it('eases with an extra crew member even with 0-rated players', () => {
    const one = computeDial([0], 'anyGame', 4, cfg);
    const two = computeDial([0, 0], 'anyGame', 4, cfg);
    expect(one).toBeGreaterThan(two);
  });

  it('falls back to _default curve for an unregistered gameId', () => {
    const result = computeDial([2], 'unknownGame', 4, cfg);
    // base(1.0) + perLanePoint(-0.15) * 2 - tightenPerExtraCrew(0.1) * 0 = 1.0 - 0.3 = 0.7
    expect(result).toBeCloseTo(0.7);
  });

  it('computes correctly for 2 players with rating 2 each', () => {
    // base(1.0) + perLanePoint(-0.15) * (2+2) - tightenPerExtraCrew(0.1) * (2-1)
    // = 1.0 - 0.6 - 0.1 = 0.3
    expect(computeDial([2, 2], 'anyGame', 4, cfg)).toBeCloseTo(0.3);
  });

  it('computes correctly for 1 player with rating 3', () => {
    // base(1.0) + perLanePoint(-0.15) * 3 - tightenPerExtraCrew(0.1) * 0
    // = 1.0 - 0.45 - 0.0 = 0.55
    expect(computeDial([3], 'anyGame', 4, cfg)).toBeCloseTo(0.55);
  });

  it('throws when no curve exists for gameId and no _default', () => {
    const noCurves = {
      ...cfg,
      scaling: { ...cfg.scaling, dialCurve: {} },
    } as unknown as EngineConfig;
    expect(() => computeDial([1], 'anyGame', 4, noCurves)).toThrow();
  });

  it('is deterministic: same inputs ⇒ same result', () => {
    const r1 = computeDial([1, 2, 3], 'anyGame', 7, cfg);
    const r2 = computeDial([1, 2, 3], 'anyGame', 7, cfg);
    expect(r1).toBe(r2);
  });
});
