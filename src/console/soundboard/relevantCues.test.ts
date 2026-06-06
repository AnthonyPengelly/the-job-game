import { describe, it, expect } from 'vitest';
import { relevantCues } from './relevantCues';
import type { ParsedSoundManifest } from '@/content/schema';

// ── Fixture manifest (mirrors the default preset content) ─────────────────────

const testManifest: ParsedSoundManifest = {
  cues: [
    {
      id: 'ambient-drone',
      src: 'sound/ambient-drone.wav',
      channel: 'ambient',
      loop: true,
      gain: 0.6,
      phases: ['briefing', 'room', 'minigame', 'offer'],
    },
    {
      id: 'ambient-heartbeat',
      src: 'sound/ambient-heartbeat.wav',
      channel: 'ambient',
      loop: true,
      gain: 0.8,
      phases: ['briefing', 'room', 'minigame', 'offer'],
    },
    {
      id: 'sfx-lock',
      src: 'sound/sfx-lock.wav',
      channel: 'heistSfx',
      gain: 1.0,
      phases: ['room', 'minigame'],
    },
    {
      id: 'sfx-footstep',
      src: 'sound/sfx-footstep.wav',
      channel: 'heistSfx',
      gain: 0.9,
      phases: ['room', 'minigame', 'offer'],
    },
    {
      id: 'sting-win',
      src: 'sound/sting-win.wav',
      channel: 'sting',
      gain: 1.0,
      phases: ['result'],
    },
    {
      id: 'sting-bust',
      src: 'sound/sting-bust.wav',
      channel: 'sting',
      gain: 1.0,
      phases: ['result'],
    },
    {
      id: 'danger-alarm',
      src: 'sound/danger-alarm.wav',
      channel: 'danger',
      loop: true,
      gain: 1.0,
      phases: ['room', 'minigame', 'offer'],
    },
    {
      id: 'finale-escape',
      src: 'sound/finale-escape.wav',
      channel: 'finale',
      gain: 1.0,
      phases: ['getaway'],
    },
    {
      id: 'finale-credits',
      src: 'sound/finale-credits.wav',
      channel: 'finale',
      gain: 0.8,
      phases: ['getaway', 'result'],
    },
  ],
  ambientBed: { droneId: 'ambient-drone', heartbeatId: 'ambient-heartbeat' },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('relevantCues', () => {
  describe('briefing phase', () => {
    it('includes only ambient cues', () => {
      const groups = relevantCues('briefing', testManifest);
      expect(groups.ambient?.map(c => c.id)).toEqual([
        'ambient-drone',
        'ambient-heartbeat',
      ]);
    });

    it('excludes heistSfx, sting, danger, and finale groups', () => {
      const groups = relevantCues('briefing', testManifest);
      expect(groups.heistSfx).toBeUndefined();
      expect(groups.sting).toBeUndefined();
      expect(groups.danger).toBeUndefined();
      expect(groups.finale).toBeUndefined();
    });
  });

  describe('room phase', () => {
    it('includes ambient, heistSfx, and danger cues', () => {
      const groups = relevantCues('room', testManifest);
      expect(groups.ambient?.map(c => c.id)).toEqual([
        'ambient-drone',
        'ambient-heartbeat',
      ]);
      expect(groups.heistSfx?.map(c => c.id)).toEqual(['sfx-lock', 'sfx-footstep']);
      expect(groups.danger?.map(c => c.id)).toEqual(['danger-alarm']);
    });

    it('excludes sting and finale cues', () => {
      const groups = relevantCues('room', testManifest);
      expect(groups.sting).toBeUndefined();
      expect(groups.finale).toBeUndefined();
    });
  });

  describe('minigame phase', () => {
    it('includes ambient, heistSfx, and danger cues', () => {
      const groups = relevantCues('minigame', testManifest);
      expect(groups.ambient?.map(c => c.id)).toEqual([
        'ambient-drone',
        'ambient-heartbeat',
      ]);
      expect(groups.heistSfx?.map(c => c.id)).toEqual(['sfx-lock', 'sfx-footstep']);
      expect(groups.danger?.map(c => c.id)).toEqual(['danger-alarm']);
    });
  });

  describe('offer phase', () => {
    it('includes ambient, heistSfx (footstep only), and danger cues', () => {
      const groups = relevantCues('offer', testManifest);
      expect(groups.ambient?.map(c => c.id)).toEqual([
        'ambient-drone',
        'ambient-heartbeat',
      ]);
      // sfx-lock is NOT in offer phase; sfx-footstep is
      expect(groups.heistSfx?.map(c => c.id)).toEqual(['sfx-footstep']);
      expect(groups.danger?.map(c => c.id)).toEqual(['danger-alarm']);
    });

    it('excludes sting and finale groups', () => {
      const groups = relevantCues('offer', testManifest);
      expect(groups.sting).toBeUndefined();
      expect(groups.finale).toBeUndefined();
    });
  });

  describe('getaway phase', () => {
    it('includes only finale cues', () => {
      const groups = relevantCues('getaway', testManifest);
      expect(groups.finale?.map(c => c.id)).toEqual([
        'finale-escape',
        'finale-credits',
      ]);
    });

    it('excludes ambient, heistSfx, sting, and danger groups', () => {
      const groups = relevantCues('getaway', testManifest);
      expect(groups.ambient).toBeUndefined();
      expect(groups.heistSfx).toBeUndefined();
      expect(groups.sting).toBeUndefined();
      expect(groups.danger).toBeUndefined();
    });
  });

  describe('result phase', () => {
    it('includes only sting and finale (credits) cues', () => {
      const groups = relevantCues('result', testManifest);
      expect(groups.sting?.map(c => c.id)).toEqual(['sting-win', 'sting-bust']);
      expect(groups.finale?.map(c => c.id)).toEqual(['finale-credits']);
    });

    it('excludes ambient, heistSfx, and danger groups', () => {
      const groups = relevantCues('result', testManifest);
      expect(groups.ambient).toBeUndefined();
      expect(groups.heistSfx).toBeUndefined();
      expect(groups.danger).toBeUndefined();
    });
  });

  describe('cross-phase correctness', () => {
    it('danger-alarm appears only in room, minigame, offer — not briefing, getaway, result', () => {
      expect(relevantCues('briefing', testManifest).danger).toBeUndefined();
      expect(relevantCues('room', testManifest).danger?.map(c => c.id)).toContain('danger-alarm');
      expect(relevantCues('minigame', testManifest).danger?.map(c => c.id)).toContain('danger-alarm');
      expect(relevantCues('offer', testManifest).danger?.map(c => c.id)).toContain('danger-alarm');
      expect(relevantCues('getaway', testManifest).danger).toBeUndefined();
      expect(relevantCues('result', testManifest).danger).toBeUndefined();
    });

    it('finale-escape appears only in getaway', () => {
      const allPhases = ['briefing', 'room', 'minigame', 'offer', 'getaway', 'result'] as const;
      for (const phase of allPhases) {
        const ids = relevantCues(phase, testManifest).finale?.map(c => c.id) ?? [];
        if (phase === 'getaway') {
          expect(ids).toContain('finale-escape');
        } else if (phase === 'result') {
          // finale-credits appears in result but not finale-escape
          expect(ids).not.toContain('finale-escape');
        } else {
          expect(ids).not.toContain('finale-escape');
        }
      }
    });

    it('each returned cue id is unique within its group', () => {
      const allPhases = ['briefing', 'room', 'minigame', 'offer', 'getaway', 'result'] as const;
      for (const phase of allPhases) {
        const groups = relevantCues(phase, testManifest);
        for (const [, cues] of Object.entries(groups)) {
          const ids = (cues ?? []).map(c => c.id);
          const unique = new Set(ids);
          expect(unique.size).toBe(ids.length);
        }
      }
    });
  });
});
