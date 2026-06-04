import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { loadPreset } from './load';

describe('loadPreset', () => {
  describe('default preset', () => {
    it('returns an EngineConfig whose heat numbers match tuning.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.heat.hMax).toBe(20);
      expect(cfg.heat.runAtFraction).toBe(0.55);
    });

    it('returns escalation fields matching tuning.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.escalation.onsetRoom).toBe(5);
      expect(cfg.escalation.rampPerObstacle).toBe(0.2);
    });

    it('returns obstacleHeat fields matching tuning.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.obstacleHeat.safe).toBe(1);
      expect(cfg.obstacleHeat.greedy).toBe(2);
      expect(cfg.obstacleHeat.greedyBelowFraction).toBe(0.5);
    });

    it('returns outcomeHeat fields matching tuning.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.outcomeHeat.clean).toBe(0);
      expect(cfg.outcomeHeat.complication).toBe(1);
      expect(cfg.outcomeHeat.botched).toBe(2);
    });

    it('returns outcomeLoot fields matching tuning.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.outcomeLoot.complication).toBe(1);
      expect(cfg.outcomeLoot.botched).toBe(0);
    });

    it('returns scenarioSwing fields matching tuning.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.scenarioSwing.small).toBe(2);
      expect(cfg.scenarioSwing.big).toBe(4);
    });

    it('returns getaway curve fields matching tuning.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.getaway.exponent).toBe(1.3);
      expect(cfg.getaway.skillTerm).toBe(0.5);
      expect(cfg.getaway.skillPivot).toBe(0.65);
      expect(cfg.getaway.headcountTerm).toBe(0.8);
      expect(cfg.getaway.clamp).toEqual([0.04, 0.97]);
    });

    it('returns scoring fields matching tuning.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.scoring.winBaseMultiplier).toBe(1.0);
      expect(cfg.scoring.lowHeatStyleBonus).toBe(0.5);
      expect(cfg.scoring.bustMultiplier).toBe(0.4);
    });

    it('returns scaling profiles with getawayBonus from scaling.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.scaling.profiles['2']?.getawayBonus).toBe(-0.04);
      expect(cfg.scaling.profiles['4']?.getawayBonus).toBe(0.0);
      expect(cfg.scaling.profiles['7']?.getawayBonus).toBe(0.05);
    });

    it('returns scaling profiles with crewPerOption from scaling.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.scaling.profiles['2']?.crewPerOption).toEqual([1, 2]);
      expect(cfg.scaling.profiles['5']?.crewPerOption).toEqual([2, 3]);
    });

    it('returns scaling profiles with exhaustion class from scaling.json', () => {
      const cfg = loadPreset('default');
      expect(cfg.scaling.profiles['2']?.exhaustion).toBe('tired');
      expect(cfg.scaling.profiles['3']?.exhaustion).toBe('tired');
      expect(cfg.scaling.profiles['4']?.exhaustion).toBe('light');
      expect(cfg.scaling.profiles['5']?.exhaustion).toBe('full');
      expect(cfg.scaling.profiles['6']?.exhaustion).toBe('full');
      expect(cfg.scaling.profiles['7']?.exhaustion).toBe('full');
    });

    it('returns exhaustionRest with correct rooms-benched values', () => {
      const cfg = loadPreset('default');
      expect(cfg.scaling.exhaustionRest.full).toBe(1);
      expect(cfg.scaling.exhaustionRest.light).toBe(1);
      expect(cfg.scaling.exhaustionRest.tired).toBe(0);
    });

    it('returns scaling.minCommit keyed by gameId', () => {
      const cfg = loadPreset('default');
      expect(cfg.scaling.minCommit['crackTheTumblers']).toBe(1);
      expect(cfg.scaling.minCommit['assemblyLine']).toBe(2);
    });

    it('returns scaling.variant with appliesAt arrays', () => {
      const cfg = loadPreset('default');
      expect(cfg.scaling.variant['crackTheTumblers']?.appliesAt).toEqual([1]);
      expect(cfg.scaling.variant['crackTheTumblers']?.soloVariantId).toBe('crackTheTumblersSolo');
    });

    it('returns scaling.excludedFromSolo as a string array', () => {
      const cfg = loadPreset('default');
      expect(cfg.scaling.excludedFromSolo).toContain('assemblyLine');
      expect(cfg.scaling.excludedFromSolo).toContain('defuseTheAlarm');
    });

    it('returns scaling.soloEligibleMinPool as a positive integer', () => {
      const cfg = loadPreset('default');
      expect(cfg.scaling.soloEligibleMinPool).toBe(8);
    });

    it('returns scaling.dialCurve with _default entry', () => {
      const cfg = loadPreset('default');
      const def = cfg.scaling.dialCurve['_default'];
      expect(def).toBeDefined();
      expect(def?.base).toBe(1.0);
      expect(def?.perLanePoint).toBe(-0.15);
      expect(def?.tightenPerExtraCrew).toBe(0.1);
    });

    it('new scaling fields are frozen', () => {
      const cfg = loadPreset('default');
      expect(Object.isFrozen(cfg.scaling.exhaustionRest)).toBe(true);
      expect(Object.isFrozen(cfg.scaling.variant)).toBe(true);
      expect(Object.isFrozen(cfg.scaling.excludedFromSolo)).toBe(true);
      expect(Object.isFrozen(cfg.scaling.dialCurve)).toBe(true);
    });

    it('returns a deeply frozen object (top-level and nested)', () => {
      const cfg = loadPreset('default');
      expect(Object.isFrozen(cfg)).toBe(true);
      expect(Object.isFrozen(cfg.heat)).toBe(true);
      expect(Object.isFrozen(cfg.getaway)).toBe(true);
      expect(Object.isFrozen(cfg.scaling)).toBe(true);
      expect(Object.isFrozen(cfg.scaling.profiles['2'])).toBe(true);
    });

    it('is deterministic — repeated calls return equal configs', () => {
      const a = loadPreset('default');
      const b = loadPreset('default');
      expect(a.heat.hMax).toBe(b.heat.hMax);
      expect(a.getaway.clamp).toEqual(b.getaway.clamp);
      expect(a.scaling.minCommit).toEqual(b.scaling.minCommit);
    });
  });

  describe('roomTemplates', () => {
    it('loads roomTemplates with at least one obstacle and one scenario', () => {
      const cfg = loadPreset('default');
      expect(cfg.roomTemplates.obstacles.length).toBeGreaterThanOrEqual(1);
      expect(cfg.roomTemplates.scenarios.length).toBeGreaterThanOrEqual(1);
    });

    it('all obstacle gameIds are keys in scaling.minCommit', () => {
      const cfg = loadPreset('default');
      for (const t of cfg.roomTemplates.obstacles) {
        expect(cfg.scaling.minCommit[t.gameId]).toBeDefined();
      }
    });

    it('obstacle options are ordered [safe, greedy]', () => {
      const cfg = loadPreset('default');
      for (const t of cfg.roomTemplates.obstacles) {
        expect(t.options[0].greedy).toBe(false);
        expect(t.options[1].greedy).toBe(true);
      }
    });

    it('generation.obstacleRatio matches tuning.json (0.6)', () => {
      const cfg = loadPreset('default');
      expect(cfg.generation.obstacleRatio).toBe(0.6);
    });

    it('roomTemplates config is frozen', () => {
      const cfg = loadPreset('default');
      expect(Object.isFrozen(cfg.roomTemplates)).toBe(true);
    });
  });

  describe('gear catalog', () => {
    it('loads a gear catalog with at least one statBoost and one powerUp', () => {
      const cfg = loadPreset('default');
      const items = Object.values(cfg.gear);
      expect(items.some(g => g.kind === 'statBoost')).toBe(true);
      expect(items.some(g => g.kind === 'powerUp')).toBe(true);
    });

    it('stat-tech-1 has magnitude 1 and lane tech', () => {
      const cfg = loadPreset('default');
      const item = cfg.gear['stat-tech-1'];
      expect(item?.kind).toBe('statBoost');
      expect(item?.lane).toBe('tech');
      if (item?.kind === 'statBoost') {
        expect(item.magnitude).toBe(1);
      }
    });

    it('stat-tech-2 (Big Score) has magnitude 2', () => {
      const cfg = loadPreset('default');
      const item = cfg.gear['stat-tech-2'];
      expect(item?.kind).toBe('statBoost');
      if (item?.kind === 'statBoost') {
        expect(item.magnitude).toBe(2);
      }
    });

    it('powerup-tech has kind powerUp and lane tech', () => {
      const cfg = loadPreset('default');
      const item = cfg.gear['powerup-tech'];
      expect(item?.kind).toBe('powerUp');
      expect(item?.lane).toBe('tech');
    });

    it('gear catalog is frozen', () => {
      const cfg = loadPreset('default');
      expect(Object.isFrozen(cfg.gear)).toBe(true);
    });
  });

  describe('malformed fixture', () => {
    it('throws a ZodError when a required field has the wrong type', () => {
      expect(() => loadPreset('test-malformed')).toThrow(ZodError);
    });

    it('ZodError cites the offending path (heat.hMax)', () => {
      let caught: unknown;
      try {
        loadPreset('test-malformed');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ZodError);
      if (caught instanceof ZodError) {
        const paths = caught.issues.map((issue) => issue.path);
        const mentionsHMax = paths.some((path) => path.includes('hMax'));
        expect(mentionsHMax).toBe(true);
      }
    });
  });
});
