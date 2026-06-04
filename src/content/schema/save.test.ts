import { describe, it, expect } from 'vitest';
import { runEventSchema, saveEnvelopeSchema, SAVE_VERSION, parseSaveEnvelope } from './save';

// ── runEventSchema tests ──────────────────────────────────────────────────────

describe('runEventSchema', () => {
  it('accepts START_RUN with crew and optional seed', () => {
    const event = { t: 'START_RUN', crew: [{ name: 'Alex' }, { name: 'Blair', quirk: 'smooth-talker' }], seed: 1312 };
    expect(runEventSchema.safeParse(event).success).toBe(true);
  });

  it('accepts START_RUN without seed', () => {
    const event = { t: 'START_RUN', crew: [{ name: 'Alex' }] };
    expect(runEventSchema.safeParse(event).success).toBe(true);
  });

  it('accepts CHOOSE_OPTION', () => {
    const event = { t: 'CHOOSE_OPTION', optionId: 'opt-a', committed: ['player-0', 'player-1'] };
    expect(runEventSchema.safeParse(event).success).toBe(true);
  });

  it('accepts RESOLVE_MINIGAME with each outcome', () => {
    for (const outcome of ['clean', 'complication', 'botched'] as const) {
      expect(runEventSchema.safeParse({ t: 'RESOLVE_MINIGAME', outcome }).success).toBe(true);
    }
  });

  it('rejects RESOLVE_MINIGAME with unknown outcome', () => {
    expect(runEventSchema.safeParse({ t: 'RESOLVE_MINIGAME', outcome: 'perfect' }).success).toBe(false);
  });

  it('accepts CHOOSE_SCENARIO with and without attemptedBy', () => {
    expect(runEventSchema.safeParse({ t: 'CHOOSE_SCENARIO', choiceId: 'choice-a' }).success).toBe(true);
    expect(runEventSchema.safeParse({ t: 'CHOOSE_SCENARIO', choiceId: 'choice-a', attemptedBy: 'player-0' }).success).toBe(true);
  });

  it('accepts ASSIGN_GEAR', () => {
    expect(runEventSchema.safeParse({ t: 'ASSIGN_GEAR', gear: 'safecracker-kit', to: 'player-0' }).success).toBe(true);
  });

  it('accepts PUSH_ON and CALL_GETAWAY', () => {
    expect(runEventSchema.safeParse({ t: 'PUSH_ON' }).success).toBe(true);
    expect(runEventSchema.safeParse({ t: 'CALL_GETAWAY' }).success).toBe(true);
  });

  it('accepts RESOLVE_GETAWAY with and without win', () => {
    expect(runEventSchema.safeParse({ t: 'RESOLVE_GETAWAY' }).success).toBe(true);
    expect(runEventSchema.safeParse({ t: 'RESOLVE_GETAWAY', win: true }).success).toBe(true);
    expect(runEventSchema.safeParse({ t: 'RESOLVE_GETAWAY', win: false }).success).toBe(true);
  });

  it('accepts all override events', () => {
    const overrides = [
      { t: 'OVERRIDE_SET_HEAT', value: 5 },
      { t: 'OVERRIDE_ADJUST_HEAT', delta: -2 },
      { t: 'OVERRIDE_SET_LOOT', value: 10 },
      { t: 'OVERRIDE_ADJUST_LOOT', delta: 3 },
      { t: 'OVERRIDE_SET_STAT', player: 'player-0', lane: 'tech', value: 2 },
      { t: 'OVERRIDE_ADJUST_STAT', player: 'player-0', lane: 'charm', delta: 1 },
      { t: 'OVERRIDE_SET_POWERUP', player: 'player-0', lane: 'stealth', held: true },
      { t: 'OVERRIDE_SET_RESTING', player: 'player-0', untilRoom: 3 },
      { t: 'OVERRIDE_SET_RESTING', player: 'player-0' },
      { t: 'OVERRIDE_REROLL_ROOM' },
      { t: 'OVERRIDE_SKIP_ROOM' },
      { t: 'OVERRIDE_SET_PHASE', phase: 'offer' },
    ];
    for (const event of overrides) {
      const result = runEventSchema.safeParse(event);
      expect(result.success, `Expected success for ${event.t}`).toBe(true);
    }
  });

  it('rejects an unknown event t', () => {
    expect(runEventSchema.safeParse({ t: 'UNKNOWN_EVENT', foo: 'bar' }).success).toBe(false);
    expect(runEventSchema.safeParse({ t: 'START_RN', crew: [] }).success).toBe(false);
  });

  it('rejects a missing t field', () => {
    expect(runEventSchema.safeParse({ crew: [{ name: 'Alex' }] }).success).toBe(false);
  });

  it('rejects override with invalid lane', () => {
    expect(runEventSchema.safeParse({ t: 'OVERRIDE_SET_STAT', player: 'player-0', lane: 'agility', value: 1 }).success).toBe(false);
  });

  it('rejects override with invalid phase', () => {
    expect(runEventSchema.safeParse({ t: 'OVERRIDE_SET_PHASE', phase: 'lobby' }).success).toBe(false);
  });
});

// ── saveEnvelopeSchema tests ──────────────────────────────────────────────────

describe('saveEnvelopeSchema', () => {
  it('accepts a valid envelope with a representative event log', () => {
    const envelope = {
      version: SAVE_VERSION,
      seed: 1312,
      eventLog: [
        { t: 'START_RUN', crew: [{ name: 'Alex' }, { name: 'Blair' }], seed: 1312 },
        { t: 'CHOOSE_OPTION', optionId: 'opt-a', committed: ['player-0'] },
        { t: 'RESOLVE_MINIGAME', outcome: 'clean' },
        { t: 'OVERRIDE_SET_HEAT', value: 8 },
        { t: 'PUSH_ON' },
        { t: 'CALL_GETAWAY' },
        { t: 'RESOLVE_GETAWAY', win: true },
      ],
    };
    expect(saveEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it('rejects an event log containing an unknown event t', () => {
    const envelope = {
      version: SAVE_VERSION,
      seed: 1312,
      eventLog: [
        { t: 'START_RUN', crew: [{ name: 'Alex' }] },
        { t: 'INVALID_EVENT', data: 42 },
      ],
    };
    expect(saveEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it('rejects a negative version', () => {
    expect(saveEnvelopeSchema.safeParse({ version: -1, seed: 0, eventLog: [] }).success).toBe(false);
  });

  it('rejects a negative seed', () => {
    expect(saveEnvelopeSchema.safeParse({ version: 1, seed: -1, eventLog: [] }).success).toBe(false);
  });

  it('rejects a missing eventLog', () => {
    expect(saveEnvelopeSchema.safeParse({ version: 1, seed: 0 }).success).toBe(false);
  });
});

// ── parseSaveEnvelope helper tests ────────────────────────────────────────────

describe('parseSaveEnvelope', () => {
  it('returns a SaveEnvelope with eventLog typed as RunEvent[]', () => {
    const result = parseSaveEnvelope({
      version: SAVE_VERSION,
      seed: 42,
      eventLog: [
        { t: 'START_RUN', crew: [{ name: 'River' }] },
        { t: 'PUSH_ON' },
        { t: 'CALL_GETAWAY' },
        { t: 'RESOLVE_GETAWAY' },
      ],
    });
    expect(result.version).toBe(SAVE_VERSION);
    expect(result.seed).toBe(42);
    expect(result.eventLog).toHaveLength(4);
    expect(result.eventLog[0]).toMatchObject({ t: 'START_RUN' });
  });

  it('throws on malformed data', () => {
    expect(() => parseSaveEnvelope({ version: 1, seed: 'bad', eventLog: [] })).toThrow();
    expect(() => parseSaveEnvelope(null)).toThrow();
    expect(() => parseSaveEnvelope('not an object')).toThrow();
  });
});
