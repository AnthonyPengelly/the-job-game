import { describe, it, expect } from 'vitest';
import {
  LEADERBOARD_VERSION,
  leaderboardEntrySchema,
  leaderboardEnvelopeSchema,
} from './leaderboard';
import type { LeaderboardEntry, LeaderboardEnvelope } from './leaderboard';

const VALID_ENTRY: LeaderboardEntry = {
  runSeed: 1312,
  score: 42.5,
  loot: 30,
  heatAtGetaway: 8,
  win: true,
  crewSize: 4,
  crewName: 'The Magpies',
  finishedAt: 1700000000000,
};

const VALID_ENVELOPE: LeaderboardEnvelope = {
  version: LEADERBOARD_VERSION,
  entries: [VALID_ENTRY],
};

describe('leaderboardEntrySchema', () => {
  it('accepts a valid entry', () => {
    const result = leaderboardEntrySchema.safeParse(VALID_ENTRY);
    expect(result.success).toBe(true);
  });

  it('accepts a win=false bust entry', () => {
    const result = leaderboardEntrySchema.safeParse({ ...VALID_ENTRY, win: false });
    expect(result.success).toBe(true);
  });

  it('accepts score=0 (bust with zero loot)', () => {
    const result = leaderboardEntrySchema.safeParse({ ...VALID_ENTRY, score: 0, loot: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts heatAtGetaway above the default hMax (preset-tunable ceiling)', () => {
    const result = leaderboardEntrySchema.safeParse({ ...VALID_ENTRY, heatAtGetaway: 25 });
    expect(result.success).toBe(true);
  });

  it('rejects crewSize < 1', () => {
    const result = leaderboardEntrySchema.safeParse({ ...VALID_ENTRY, crewSize: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects crewSize > 7', () => {
    const result = leaderboardEntrySchema.safeParse({ ...VALID_ENTRY, crewSize: 8 });
    expect(result.success).toBe(false);
  });

  it('rejects negative runSeed', () => {
    const result = leaderboardEntrySchema.safeParse({ ...VALID_ENTRY, runSeed: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const noScore = { ...VALID_ENTRY, score: undefined };
    const result = leaderboardEntrySchema.safeParse(noScore);
    expect(result.success).toBe(false);
  });

  it('rejects missing crewName', () => {
    const withoutCrew = { ...VALID_ENTRY, crewName: undefined };
    const result = leaderboardEntrySchema.safeParse(withoutCrew);
    expect(result.success).toBe(false);
  });

  it('accepts an empty-string crewName (run started without a name)', () => {
    const result = leaderboardEntrySchema.safeParse({ ...VALID_ENTRY, crewName: '' });
    expect(result.success).toBe(true);
  });
});

describe('LEADERBOARD_VERSION', () => {
  it('is 2', () => {
    expect(LEADERBOARD_VERSION).toBe(2);
  });
});

describe('leaderboardEnvelopeSchema', () => {
  it('accepts a valid envelope with entries', () => {
    const result = leaderboardEnvelopeSchema.safeParse(VALID_ENVELOPE);
    expect(result.success).toBe(true);
  });

  it('accepts an empty entries array', () => {
    const result = leaderboardEnvelopeSchema.safeParse({ version: LEADERBOARD_VERSION, entries: [] });
    expect(result.success).toBe(true);
  });

  it('accepts multiple entries', () => {
    const result = leaderboardEnvelopeSchema.safeParse({
      version: LEADERBOARD_VERSION,
      entries: [VALID_ENTRY, { ...VALID_ENTRY, runSeed: 99, score: 10 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing version', () => {
    const noVersion = { entries: VALID_ENVELOPE.entries };
    const result = leaderboardEnvelopeSchema.safeParse(noVersion);
    expect(result.success).toBe(false);
  });

  it('rejects missing entries', () => {
    const result = leaderboardEnvelopeSchema.safeParse({ version: LEADERBOARD_VERSION });
    expect(result.success).toBe(false);
  });

  it('rejects entries with an invalid member', () => {
    const result = leaderboardEnvelopeSchema.safeParse({
      version: LEADERBOARD_VERSION,
      entries: [{ ...VALID_ENTRY, crewSize: 0 }],
    });
    expect(result.success).toBe(false);
  });
});
