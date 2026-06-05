import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { loadDefaultConfig, loadDefaultNarration } from './browser';
import { loadPreset, loadNarration } from './load';
import { buildConfig } from './build-config';
import { tuningSchema, scalingSchema, metaSchema, roomTemplatesSchema, scenariosSchema, gearSchema, categoriesBankSchema, triviaBankSchema, narrationSchema } from '@/content/schema';

import metaJson from '../../../presets/default/_meta.json';
import tuningJson from '../../../presets/default/tuning.json';
import scalingJson from '../../../presets/default/scaling.json';
import roomTemplatesJson from '../../../presets/default/content/roomTemplates.json';
import scenariosJson from '../../../presets/default/content/scenarios.json';
import gearJson from '../../../presets/default/content/gear.json';
import categoriesJson from '../../../presets/default/content/banks/categories.json';
import triviaJson from '../../../presets/default/content/banks/trivia.json';

describe('loadDefaultConfig', () => {
  it('deep-equals the Node loadPreset("default") output', () => {
    const browserCfg = loadDefaultConfig();
    const nodeCfg = loadPreset('default');

    expect(browserCfg.heat).toEqual(nodeCfg.heat);
    expect(browserCfg.escalation).toEqual(nodeCfg.escalation);
    expect(browserCfg.obstacleHeat).toEqual(nodeCfg.obstacleHeat);
    expect(browserCfg.outcomeHeat).toEqual(nodeCfg.outcomeHeat);
    expect(browserCfg.outcomeLoot).toEqual(nodeCfg.outcomeLoot);
    expect(browserCfg.scenarioSwing).toEqual(nodeCfg.scenarioSwing);
    expect(browserCfg.getaway).toEqual(nodeCfg.getaway);
    expect(browserCfg.scoring).toEqual(nodeCfg.scoring);
    expect(browserCfg.scaling).toEqual(nodeCfg.scaling);
    expect(browserCfg.generation).toEqual(nodeCfg.generation);
    expect(browserCfg.roomTemplates).toEqual(nodeCfg.roomTemplates);
    expect(browserCfg.gear).toEqual(nodeCfg.gear);
    expect(browserCfg.banks).toEqual(nodeCfg.banks);
  });

  it('returns a deeply frozen EngineConfig', () => {
    const cfg = loadDefaultConfig();
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(Object.isFrozen(cfg.heat)).toBe(true);
    expect(Object.isFrozen(cfg.scaling)).toBe(true);
    expect(Object.isFrozen(cfg.gear)).toBe(true);
  });
});

describe('buildConfig with malformed input', () => {
  it('throws ZodError when tuning has wrong type for hMax', () => {
    const malformedTuning = { ...tuningJson, heat: { hMax: 'not-a-number', runAtFraction: 0.55 } };
    expect(() => {
      const meta = metaSchema.parse(metaJson);
      const tuning = tuningSchema.parse(malformedTuning);
      const scaling = scalingSchema.parse(scalingJson);
      const roomTemplates = roomTemplatesSchema.parse(roomTemplatesJson);
      const scenarios = scenariosSchema.parse(scenariosJson);
      const gear = gearSchema.parse(gearJson);
      const categoriesBank = categoriesBankSchema.parse(categoriesJson);
      const triviaBank = triviaBankSchema.parse(triviaJson);
      buildConfig({ meta, tuning, scaling, roomTemplates, scenarios, gear, categoriesBank, triviaBank });
    }).toThrow(ZodError);
  });

  it('throws ZodError when scaling has an invalid exhaustion class', () => {
    const malformedScaling = {
      ...scalingJson,
      profiles: {
        ...scalingJson.profiles,
        '2': { ...scalingJson.profiles['2'], exhaustion: 'extreme' },
      },
    };
    expect(() => {
      const meta = metaSchema.parse(metaJson);
      const tuning = tuningSchema.parse(tuningJson);
      const scaling = scalingSchema.parse(malformedScaling);
      const roomTemplates = roomTemplatesSchema.parse(roomTemplatesJson);
      const scenarios = scenariosSchema.parse(scenariosJson);
      const gear = gearSchema.parse(gearJson);
      const categoriesBank = categoriesBankSchema.parse(categoriesJson);
      const triviaBank = triviaBankSchema.parse(triviaJson);
      buildConfig({ meta, tuning, scaling, roomTemplates, scenarios, gear, categoriesBank, triviaBank });
    }).toThrow(ZodError);
  });

  it('throws ZodError when gear has an unknown kind', () => {
    const malformedGear = {
      ...gearJson,
      items: [{ id: 'bad-item', kind: 'unknown', lane: 'tech' }],
    };
    expect(() => {
      const meta = metaSchema.parse(metaJson);
      const tuning = tuningSchema.parse(tuningJson);
      const scaling = scalingSchema.parse(scalingJson);
      const roomTemplates = roomTemplatesSchema.parse(roomTemplatesJson);
      const scenarios = scenariosSchema.parse(scenariosJson);
      const gear = gearSchema.parse(malformedGear);
      const categoriesBank = categoriesBankSchema.parse(categoriesJson);
      const triviaBank = triviaBankSchema.parse(triviaJson);
      buildConfig({ meta, tuning, scaling, roomTemplates, scenarios, gear, categoriesBank, triviaBank });
    }).toThrow(ZodError);
  });
});

describe('loadDefaultNarration', () => {
  it('returns a parsed narration bank with all ten beats', () => {
    const bank = loadDefaultNarration();
    expect(bank).toBeDefined();
    expect(Array.isArray(bank.briefing)).toBe(true);
    expect(Array.isArray(bank.obstacleClue)).toBe(true);
    expect(Array.isArray(bank.optionDescription)).toBe(true);
    expect(Array.isArray(bank.pushRun)).toBe(true);
    expect(Array.isArray(bank.outcomeQuip)).toBe(true);
    expect(Array.isArray(bank.scenarioSetup)).toBe(true);
    expect(Array.isArray(bank.getawayIntro)).toBe(true);
    expect(Array.isArray(bank.getawayCountdown)).toBe(true);
    expect(Array.isArray(bank.winSting)).toBe(true);
    expect(Array.isArray(bank.bustSting)).toBe(true);
  });

  it('deep-equals the Node loadNarration("default") output', () => {
    const browserBank = loadDefaultNarration();
    const nodeBank = loadNarration('default');
    expect(browserBank.briefing).toEqual(nodeBank.briefing);
    expect(browserBank.obstacleClue).toEqual(nodeBank.obstacleClue);
    expect(browserBank.winSting).toEqual(nodeBank.winSting);
    expect(browserBank.bustSting).toEqual(nodeBank.bustSting);
  });

  it('throws ZodError on a malformed narration fixture', () => {
    expect(() => narrationSchema.parse({ briefing: 'not-an-array' })).toThrow(ZodError);
  });
});
