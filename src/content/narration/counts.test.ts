import { describe, it, expect } from 'vitest';
import { narrationSchema } from '@/content/schema/narration';
import narrationJson from '../../../presets/default/content/narration.json';

const GAME_IDS = [
  'crackTheTumblers',
  'beat16',
  'categories',
  'theOnceOver',
  'followTheCircuit',
  'insideKnowledge',
  'safeCrack',
  'steadyHands',
  'assemblyLine',
  'defuseTheAlarm',
] as const;

const MANSION_TYPES = ['villa', 'estate', 'penthouse'] as const;

const bank = narrationSchema.parse(narrationJson);

describe('narration bank — minimum variant counts', () => {
  describe('briefing — ≥3 per mansionType', () => {
    for (const mt of MANSION_TYPES) {
      it(`mansionType="${mt}" has ≥3 variants`, () => {
        const count = bank.briefing.filter((v) => v.when?.mansionType === mt).length;
        expect(count).toBeGreaterThanOrEqual(3);
      });
    }

    it('has ≥9 total variants', () => {
      expect(bank.briefing.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('obstacleClue — ≥4 per gameId (all 10 games)', () => {
    for (const gameId of GAME_IDS) {
      it(`gameId="${gameId}" has ≥4 variants`, () => {
        const count = bank.obstacleClue.filter((v) => v.when?.gameId === gameId).length;
        expect(count).toBeGreaterThanOrEqual(4);
      });
    }
  });

  describe('optionDescription — ≥4 greedy, ≥4 safe', () => {
    it('greedy=true has ≥4 variants', () => {
      const count = bank.optionDescription.filter((v) => v.when?.greedy === true).length;
      expect(count).toBeGreaterThanOrEqual(4);
    });

    it('greedy=false has ≥4 variants', () => {
      const count = bank.optionDescription.filter((v) => v.when?.greedy === false).length;
      expect(count).toBeGreaterThanOrEqual(4);
    });
  });

  describe('scenarioSetup — ≥6 variants', () => {
    it('has ≥6 total variants', () => {
      expect(bank.scenarioSetup.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('outcomeQuip — ≥6 per outcome', () => {
    for (const outcome of ['clean', 'complication', 'botched'] as const) {
      it(`outcome="${outcome}" has ≥6 variants`, () => {
        const count = bank.outcomeQuip.filter((v) => v.when?.outcome === outcome).length;
        expect(count).toBeGreaterThanOrEqual(6);
      });
    }
  });

  describe('pushRun — ≥4 total, some heatBand:hot', () => {
    it('has ≥4 total variants', () => {
      expect(bank.pushRun.length).toBeGreaterThanOrEqual(4);
    });

    it('has ≥1 heatBand="hot" variant', () => {
      const count = bank.pushRun.filter((v) => v.when?.heatBand === 'hot').length;
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  it('getawayIntro has ≥4 variants', () => {
    expect(bank.getawayIntro.length).toBeGreaterThanOrEqual(4);
  });

  it('getawayCountdown has ≥4 variants', () => {
    expect(bank.getawayCountdown.length).toBeGreaterThanOrEqual(4);
  });

  it('winSting has ≥4 variants', () => {
    expect(bank.winSting.length).toBeGreaterThanOrEqual(4);
  });

  it('bustSting has ≥4 variants', () => {
    expect(bank.bustSting.length).toBeGreaterThanOrEqual(4);
  });
});
