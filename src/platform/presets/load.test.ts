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

    it('returns scaling.minCommit keyed by gameId', () => {
      const cfg = loadPreset('default');
      expect(cfg.scaling.minCommit['crackTheTumblers']).toBe(1);
      expect(cfg.scaling.minCommit['assemblyLine']).toBe(2);
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
