import { describe, it, expect } from 'vitest';
import { soundManifestSchema } from '@/content/schema';
import soundJson from '../../../presets/default/content/sound.json';
import { actionBarCues } from './actionBarCues';

const manifest = soundManifestSchema.parse(soundJson);

describe('actionBarCues', () => {
  it('returns only danger/sting/finale cues for room phase', () => {
    const cues = actionBarCues('room', manifest);
    for (const cue of cues) {
      expect(['danger', 'sting', 'finale']).toContain(cue.channel);
    }
    // room phase has sting-clean/complication/botch + danger-alarm
    expect(cues.map(c => c.id)).toContain('sting-clean');
    expect(cues.map(c => c.id)).toContain('sting-complication');
    expect(cues.map(c => c.id)).toContain('sting-botch');
    expect(cues.map(c => c.id)).toContain('danger-alarm');
  });

  it('excludes ambient and heistSfx cues regardless of phase', () => {
    for (const phase of ['briefing', 'room', 'minigame', 'offer', 'getaway', 'result'] as const) {
      const cues = actionBarCues(phase, manifest);
      for (const cue of cues) {
        expect(cue.channel).not.toBe('ambient');
        expect(cue.channel).not.toBe('heistSfx');
      }
    }
  });

  it('returns getaway-phase finale cues', () => {
    const cues = actionBarCues('getaway', manifest);
    const ids = cues.map(c => c.id);
    expect(ids).toContain('finale-escape');
    expect(ids).toContain('finale-engine');
    expect(ids).toContain('finale-tyres');
    expect(ids).toContain('finale-credits');
  });

  it('returns result-phase win/bust stings', () => {
    const cues = actionBarCues('result', manifest);
    const ids = cues.map(c => c.id);
    expect(ids).toContain('sting-win');
    expect(ids).toContain('sting-bust');
  });

  it('returns empty array for briefing (no danger/sting/finale cues in briefing)', () => {
    const cues = actionBarCues('briefing', manifest);
    expect(cues).toHaveLength(0);
  });

  it('preserves manifest order within the filtered set', () => {
    const cues = actionBarCues('room', manifest);
    // Verify all returned cues have room in their phases
    for (const cue of cues) {
      expect(cue.phases).toContain('room');
    }
    // Verify ordering matches the manifest order
    const manifestOrder = manifest.cues
      .filter(c => c.phases.includes('room') && ['danger', 'sting', 'finale'].includes(c.channel))
      .map(c => c.id);
    expect(cues.map(c => c.id)).toEqual(manifestOrder);
  });

  it('works with an empty cue list', () => {
    const emptyManifest: import('@/content/schema').ParsedSoundManifest = {
      cues: [],
      ambientBed: { droneId: 'x', heartbeatId: 'y' },
    };
    const cues = actionBarCues('room', emptyManifest);
    expect(cues).toHaveLength(0);
  });
});
