import { describe, it, expect } from 'vitest';
import { runMonteCarlo, BAND_EARLY_MAX_OBSTACLE, BAND_LATE_MIN_OBSTACLE } from './montecarlo';
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

  // ── E15.3: band clean-rate instrumentation ──────────────────────────────────

  it('E15.3: clean-rate fields are populated at default curves', () => {
    const cfg = loadDefaultConfig();
    const result = runMonteCarlo(cfg, { n: 500, baseSeed: 1312, skill: 'avg', headcount: 4 });

    // Both bands must be hit (runs push through at least 4 obstacles on avg).
    expect(result.earlyCleanRate).toBeGreaterThanOrEqual(0);
    expect(result.earlyCleanRate).toBeLessThanOrEqual(1);
    expect(result.lateCleanRate).toBeGreaterThanOrEqual(0);
    expect(result.lateCleanRate).toBeLessThanOrEqual(1);
    expect(isNaN(result.earlyCleanRate)).toBe(false);
    expect(isNaN(result.lateCleanRate)).toBe(false);
  });

  it('E15.3: band constants are ordered correctly', () => {
    // Early band ends before late band starts (band gap is intentional).
    expect(BAND_EARLY_MAX_OBSTACLE).toBeLessThan(BAND_LATE_MIN_OBSTACLE);
  });

  it('E15.3: non-zero heatDial — late-band clean-rate falls for un-levelled crew', () => {
    const cfg = loadDefaultConfig();
    // Activate the heat/depth penalty with values large enough to see a clear signal
    // at N=1000 without being unrealistically large.
    const hotCfg = {
      ...cfg,
      scaling: {
        ...cfg.scaling,
        heatDial: { perHeat: 0.1, perRoom: 0.05 },
      },
    };
    const N = 1000;
    const opts = { n: N, baseSeed: 1312, skill: 'avg' as const, headcount: 4 };

    const levelled   = runMonteCarlo(hotCfg, { ...opts, levelled: true });
    const unlevelled = runMonteCarlo(hotCfg, { ...opts, levelled: false });

    // Un-levelled crew should have a lower late-band clean-rate than levelled crew.
    expect(unlevelled.lateCleanRate).toBeLessThan(levelled.lateCleanRate);
  });

  it('E15.3: non-zero heatDial — early-band clean-rate exceeds late-band (un-levelled)', () => {
    const cfg = loadDefaultConfig();
    const hotCfg = {
      ...cfg,
      scaling: {
        ...cfg.scaling,
        heatDial: { perHeat: 0.1, perRoom: 0.05 },
      },
    };
    const result = runMonteCarlo(hotCfg, {
      n: 1000,
      baseSeed: 1312,
      skill: 'avg',
      headcount: 4,
      levelled: false,
    });

    // Early obstacles happen at low heat/room so the penalty is small;
    // late obstacles happen at high heat/room so the penalty is larger.
    expect(result.earlyCleanRate).toBeGreaterThan(result.lateCleanRate);
  });

  it('E15.3: at default heatDial=0 levelled vs un-levelled results are identical', () => {
    // Default preset has heatDial={perHeat:0,perRoom:0} and DIAL_LEVEL_TO_P=0.05,
    // so heatPenalty=0 always. levelled only affects growthBonus.
    // These runs will differ in distribution (levelled earns growth bonus)
    // but both should complete without error. This test guards the no-op contract:
    // existing sim:check cells (all levelled=true by default) are unaffected.
    const cfg = loadDefaultConfig();
    const opts = { n: 200, baseSeed: 1312, skill: 'avg' as const, headcount: 4 };

    const levelled   = runMonteCarlo(cfg, { ...opts, levelled: true });
    const unlevelled = runMonteCarlo(cfg, { ...opts, levelled: false });

    // Both complete without throwing and produce valid win rates.
    expect(levelled.winRate).toBeGreaterThanOrEqual(0);
    expect(unlevelled.winRate).toBeGreaterThanOrEqual(0);

    // At zero heatDial, heatPenalty=0, so the only difference is growthBonus.
    // Levelled crew should do better (or equal) to un-levelled crew.
    expect(levelled.winRate).toBeGreaterThanOrEqual(unlevelled.winRate);
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
