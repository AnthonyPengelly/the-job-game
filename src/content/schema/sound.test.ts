import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { soundManifestSchema, soundCueSchema } from './sound';

const validCue = {
  id: 'ambient-drone',
  src: 'sound/ambient-drone.wav',
  channel: 'ambient',
  loop: true,
  gain: 0.6,
  phases: ['briefing', 'room'],
};

const validManifest = {
  cues: [
    validCue,
    {
      id: 'ambient-heartbeat',
      src: 'sound/ambient-heartbeat.wav',
      channel: 'ambient',
      loop: true,
      gain: 0.8,
      phases: ['briefing', 'room'],
    },
    {
      id: 'sfx-lock',
      src: 'sound/sfx-lock.wav',
      channel: 'heistSfx',
      phases: ['room', 'minigame'],
    },
  ],
  ambientBed: {
    droneId: 'ambient-drone',
    heartbeatId: 'ambient-heartbeat',
  },
};

describe('soundCueSchema', () => {
  it('parses a valid cue', () => {
    const result = soundCueSchema.parse(validCue);
    expect(result.id).toBe('ambient-drone');
    expect(result.channel).toBe('ambient');
    expect(result.loop).toBe(true);
    expect(result.gain).toBe(0.6);
    expect(result.phases).toEqual(['briefing', 'room']);
  });

  it('parses a cue without optional fields', () => {
    const minimal = { id: 'sfx-lock', src: 'sound/sfx-lock.wav', channel: 'heistSfx', phases: ['room'] };
    const result = soundCueSchema.parse(minimal);
    expect(result.loop).toBeUndefined();
    expect(result.gain).toBeUndefined();
  });

  it('rejects an unknown channel', () => {
    expect(() =>
      soundCueSchema.parse({ ...validCue, channel: 'unknown' }),
    ).toThrow(ZodError);
  });

  it('rejects an invalid RunPhase in phases', () => {
    expect(() =>
      soundCueSchema.parse({ ...validCue, phases: ['invalid-phase'] }),
    ).toThrow(ZodError);
  });

  it('rejects an empty phases array', () => {
    expect(() =>
      soundCueSchema.parse({ ...validCue, phases: [] }),
    ).toThrow(ZodError);
  });

  it('rejects a negative gain', () => {
    expect(() =>
      soundCueSchema.parse({ ...validCue, gain: -0.5 }),
    ).toThrow(ZodError);
  });

  it('rejects extra fields (strict)', () => {
    expect(() =>
      soundCueSchema.parse({ ...validCue, unexpected: true }),
    ).toThrow(ZodError);
  });
});

describe('soundManifestSchema', () => {
  it('parses the valid manifest', () => {
    const result = soundManifestSchema.parse(validManifest);
    expect(result.cues).toHaveLength(3);
    expect(result.ambientBed.droneId).toBe('ambient-drone');
    expect(result.ambientBed.heartbeatId).toBe('ambient-heartbeat');
  });

  it('rejects duplicate cue ids', () => {
    const withDupe = {
      ...validManifest,
      cues: [validCue, { ...validCue, src: 'sound/other.wav' }],
    };
    let caught: unknown;
    try {
      soundManifestSchema.parse(withDupe);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ZodError);
    if (caught instanceof ZodError) {
      const messages = caught.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('Duplicate cue id'))).toBe(true);
    }
  });

  it('accepts all valid RunPhase values', () => {
    const allPhases = ['briefing', 'room', 'minigame', 'offer', 'getaway', 'result'] as const;
    const cueAllPhases = { ...validCue, id: 'all-phases', phases: [...allPhases] };
    const manifest = {
      ...validManifest,
      cues: [cueAllPhases, validManifest.cues[1]],
      ambientBed: { droneId: 'all-phases', heartbeatId: 'ambient-heartbeat' },
    };
    const result = soundManifestSchema.parse(manifest);
    expect(result.cues[0]?.phases).toEqual([...allPhases]);
  });

  it('rejects cues as a non-array', () => {
    expect(() =>
      soundManifestSchema.parse({ cues: 'not-an-array', ambientBed: validManifest.ambientBed }),
    ).toThrow(ZodError);
  });

  it('rejects missing ambientBed', () => {
    expect(() =>
      soundManifestSchema.parse({ cues: validManifest.cues }),
    ).toThrow(ZodError);
  });

  it('rejects extra top-level fields (strict)', () => {
    expect(() =>
      soundManifestSchema.parse({ ...validManifest, extra: true }),
    ).toThrow(ZodError);
  });

  it('rejects a manifest where ambientBed.droneId does not reference an existing cue', () => {
    const bad = {
      ...validManifest,
      ambientBed: { droneId: 'nonexistent-drone', heartbeatId: 'ambient-heartbeat' },
    };
    let caught: unknown;
    try {
      soundManifestSchema.parse(bad);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ZodError);
    if (caught instanceof ZodError) {
      const messages = caught.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('ambientBed.droneId'))).toBe(true);
    }
  });

  it('rejects a manifest where ambientBed.heartbeatId does not reference an existing cue', () => {
    const bad = {
      ...validManifest,
      ambientBed: { droneId: 'ambient-drone', heartbeatId: 'nonexistent-heartbeat' },
    };
    let caught: unknown;
    try {
      soundManifestSchema.parse(bad);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ZodError);
    if (caught instanceof ZodError) {
      const messages = caught.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('ambientBed.heartbeatId'))).toBe(true);
    }
  });
});
