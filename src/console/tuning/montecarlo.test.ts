import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from './montecarlo';
import { loadDefaultConfig } from '@/platform/presets/browser';

describe('runMonteCarlo', () => {
  it('is deterministic: same seed produces identical distributions', () => {
    const cfg = loadDefaultConfig();
    const opts = { n: 200, baseSeed: 1312, skill: 'avg' as const, headcount: 4 };

    const result1 = runMonteCarlo(cfg, opts);
    const result2 = runMonteCarlo(cfg, opts);

    expect(result1.winRate).toBe(result2.winRate);
    expect(result1.medianObstacles).toBe(result2.medianObstacles);
    expect(result1.histogram).toEqual(result2.histogram);
  });

  it('completes a reduced-N run quickly (smoke test)', () => {
    const cfg = loadDefaultConfig();
    const result = runMonteCarlo(cfg, { n: 500, baseSeed: 42, skill: 'avg', headcount: 4 });

    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(1);
    expect(result.medianObstacles).toBeGreaterThan(0);
    expect(result.histogram.length).toBeGreaterThan(0);
    // Histogram entries are valid
    for (const bin of result.histogram) {
      expect(bin.obstacles).toBeGreaterThanOrEqual(0);
      expect(bin.count).toBeGreaterThan(0);
    }
  });

  it('different seeds produce different distributions (sanity check)', () => {
    const cfg = loadDefaultConfig();
    const base = { n: 200, skill: 'avg' as const, headcount: 4 };

    const r1 = runMonteCarlo(cfg, { ...base, baseSeed: 1312 });
    const r2 = runMonteCarlo(cfg, { ...base, baseSeed: 9999 });

    // Different seeds should (in virtually all cases) yield different win rates
    // We use a lenient check — just that the results are not structurally broken.
    expect(r1.winRate).toBeGreaterThanOrEqual(0);
    expect(r2.winRate).toBeGreaterThanOrEqual(0);
    // At least one aggregate should differ between the two seeds.
    const differs =
      r1.winRate !== r2.winRate ||
      r1.medianObstacles !== r2.medianObstacles ||
      r1.meanLoot !== r2.meanLoot;
    expect(differs).toBe(true);
  });

  it('skill ordering holds even at reduced N', () => {
    const cfg = loadDefaultConfig();
    const commonOpts = { n: 500, baseSeed: 1312, headcount: 4 };

    const bad = runMonteCarlo(cfg, { ...commonOpts, skill: 'bad' });
    const avg = runMonteCarlo(cfg, { ...commonOpts, skill: 'avg' });
    const good = runMonteCarlo(cfg, { ...commonOpts, skill: 'good' });

    // Skill ordering (assertion G) should hold even at N=500.
    expect(bad.winRate).toBeLessThan(avg.winRate);
    expect(avg.winRate).toBeLessThan(good.winRate);
  });

  it('distributions shift when tuning is hotter (E11.4 gate)', () => {
    const cfg = loadDefaultConfig();

    // Build a hotter EngineConfig by raising escalation ramp and greedy heat cost.
    // These are the two knobs the plan calls out explicitly.
    const hotterCfg = {
      ...cfg,
      escalation: {
        ...cfg.escalation,
        rampPerObstacle: cfg.escalation.rampPerObstacle * 3,
      },
      obstacleHeat: {
        ...cfg.obstacleHeat,
        greedy: cfg.obstacleHeat.greedy * 2,
      },
    };

    const opts = { n: 500, baseSeed: 1312, skill: 'avg' as const, headcount: 4 };
    const base = runMonteCarlo(cfg, opts);
    const hot = runMonteCarlo(hotterCfg, opts);

    // Hotter Heat means the run ends sooner (shorter median) and win rate drops.
    expect(hot.winRate).toBeLessThanOrEqual(base.winRate);
    expect(hot.medianObstacles).toBeLessThanOrEqual(base.medianObstacles);
    // At least one aggregate must genuinely differ.
    const shifted = hot.winRate !== base.winRate || hot.medianObstacles !== base.medianObstacles;
    expect(shifted).toBe(true);
  });
});
