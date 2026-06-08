import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { narrationSchema } from './narration';

// ── Valid fixture ─────────────────────────────────────────────────────────────

const validBank = {
  briefing: [
    { id: 'b-1', text: 'Time to crack this villa.' },
    { id: 'b-villa', text: 'Nice place.', when: { mansionType: 'villa' } },
  ],
  obstacleClue: [
    { id: 'oc-1', text: 'Van reads the locks.' },
    { id: 'oc-safe', text: 'Tumblers ahoy.', when: { gameId: 'safeCrack' } },
  ],
  optionDescription: [
    { id: 'od-1', text: 'Quick and clean.' },
    { id: 'od-greedy', text: 'Risky but worth it.', when: { greedy: true } },
  ],
  pushRun: [
    { id: 'pr-1', text: 'One more.' },
    { id: 'pr-hot', text: "Heat's rising.", when: { heatBand: 'hot' } },
  ],
  outcomeQuip: [
    { id: 'oq-clean', text: 'Textbook.', when: { outcome: 'clean' } },
    { id: 'oq-comp', text: 'Little messy.', when: { outcome: 'complication' } },
    { id: 'oq-botch', text: 'Ouch.', when: { outcome: 'botched' } },
  ],
  scenarioSetup: [
    { id: 'ss-1', text: 'Van has a situation for you.' },
  ],
  getawayIntro: [
    { id: 'gi-1', text: "Time's up — let's go." },
  ],
  getawayCountdown: [
    { id: 'gc-1', text: 'Move, move, move!' },
  ],
  winSting: [
    { id: 'ws-1', text: 'Clean getaway.' },
  ],
  bustSting: [
    { id: 'bs-1', text: 'Cuffs on.' },
  ],
  roomApproach: [
    { id: 'ra-1', text: 'Stack up — room {roomNum}.' },
  ],
  scenarioReveal: [
    { id: 'sr-1', text: 'The call is made. {outcome}.' },
  ],
};

// ── Parse valid fixture ───────────────────────────────────────────────────────

describe('narrationSchema — valid fixture', () => {
  it('parses a valid bank without throwing', () => {
    expect(() => narrationSchema.parse(validBank)).not.toThrow();
  });

  it('returns correct beat arrays', () => {
    const parsed = narrationSchema.parse(validBank);
    expect(parsed.briefing).toHaveLength(2);
    expect(parsed.outcomeQuip).toHaveLength(3);
  });

  it('preserves when conditions', () => {
    const parsed = narrationSchema.parse(validBank);
    const villaVariant = parsed.briefing.find((v) => v.id === 'b-villa');
    expect(villaVariant?.when?.mansionType).toBe('villa');
  });
});

// ── Duplicate variant ids ─────────────────────────────────────────────────────

describe('narrationSchema — duplicate variant ids', () => {
  it('rejects a beat with duplicate variant ids', () => {
    const bad = {
      ...validBank,
      briefing: [
        { id: 'dup', text: 'First.' },
        { id: 'dup', text: 'Second.' },
      ],
    };
    expect(() => narrationSchema.parse(bad)).toThrow(ZodError);
  });

  it('allows the same id in different beats', () => {
    const ok = {
      ...validBank,
      briefing: [{ id: 'shared-id', text: 'Briefing line.' }],
      pushRun: [{ id: 'shared-id', text: 'Push line.' }],
    };
    expect(() => narrationSchema.parse(ok)).not.toThrow();
  });
});

// ── Unknown when keys ─────────────────────────────────────────────────────────

describe('narrationSchema — unknown when keys', () => {
  it('rejects an unknown key in the when condition', () => {
    const bad = {
      ...validBank,
      briefing: [
        { id: 'b-1', text: 'A line.', when: { unknownKey: 'oops' } },
      ],
    };
    expect(() => narrationSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects an unknown beat field at the top level', () => {
    const bad = { ...validBank, unknownBeat: [{ id: 'x', text: 'y' }] };
    expect(() => narrationSchema.parse(bad)).toThrow(ZodError);
  });
});

// ── When condition values ─────────────────────────────────────────────────────

describe('narrationSchema — when condition values', () => {
  it('rejects an invalid mansionType value', () => {
    const bad = {
      ...validBank,
      briefing: [{ id: 'b-1', text: 'A.', when: { mansionType: 'bank' } }],
    };
    expect(() => narrationSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects an invalid outcome value', () => {
    const bad = {
      ...validBank,
      outcomeQuip: [{ id: 'oq-1', text: 'A.', when: { outcome: 'perfect' } }],
    };
    expect(() => narrationSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects an invalid lane value', () => {
    const bad = {
      ...validBank,
      obstacleClue: [{ id: 'oc-1', text: 'A.', when: { lane: 'luck' } }],
    };
    expect(() => narrationSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects an invalid heatBand value', () => {
    const bad = {
      ...validBank,
      pushRun: [{ id: 'pr-1', text: 'A.', when: { heatBand: 'scorching' } }],
    };
    expect(() => narrationSchema.parse(bad)).toThrow(ZodError);
  });
});

// ── Template token validation ─────────────────────────────────────────────────

describe('narrationVariantSchema — template token validation', () => {
  it('accepts variants with no template tokens', () => {
    expect(() =>
      narrationSchema.parse({
        ...validBank,
        briefing: [{ id: 'b-plain', text: 'No tokens here.' }],
      }),
    ).not.toThrow();
  });

  it('accepts variants with allowed tokens', () => {
    expect(() =>
      narrationSchema.parse({
        ...validBank,
        roomApproach: [{ id: 'ra-tok', text: 'Room {roomNum} — {crew} moves in on {mark}.' }],
        scenarioReveal: [{ id: 'sr-tok', text: '{outcome} at {mark}.' }],
      }),
    ).not.toThrow();
  });

  it('rejects a variant whose text uses an unknown token', () => {
    const bad = {
      ...validBank,
      briefing: [{ id: 'b-bad', text: 'Hello {unknownToken} world.' }],
    };
    expect(() => narrationSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects even one unknown token among valid tokens', () => {
    const bad = {
      ...validBank,
      roomApproach: [{ id: 'ra-bad', text: 'Room {roomNum} — {badToken}.' }],
    };
    expect(() => narrationSchema.parse(bad)).toThrow(ZodError);
  });
});

// ── New beats (roomApproach / scenarioReveal) ─────────────────────────────────

describe('narrationSchema — new beats', () => {
  it('accepts roomApproach variants', () => {
    const bank = narrationSchema.parse(validBank);
    expect(Array.isArray(bank.roomApproach)).toBe(true);
    expect(bank.roomApproach[0]?.id).toBe('ra-1');
  });

  it('accepts scenarioReveal variants', () => {
    const bank = narrationSchema.parse(validBank);
    expect(Array.isArray(bank.scenarioReveal)).toBe(true);
    expect(bank.scenarioReveal[0]?.id).toBe('sr-1');
  });

  it('rejects a bank missing roomApproach', () => {
    const { roomApproach: _omit1, ...noRoomApproach } = validBank;
    void _omit1;
    expect(() => narrationSchema.parse(noRoomApproach)).toThrow(ZodError);
  });

  it('rejects a bank missing scenarioReveal', () => {
    const { scenarioReveal: _omit2, ...noScenarioReveal } = validBank;
    void _omit2;
    expect(() => narrationSchema.parse(noScenarioReveal)).toThrow(ZodError);
  });
});
