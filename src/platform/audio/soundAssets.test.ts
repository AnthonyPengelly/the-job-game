import { describe, it, expect } from 'vitest';
import { resolveSoundUrl, createBundledFetchBuffer } from './soundAssets';
import { soundManifestSchema } from '@/content/schema';
import soundJson from '../../../presets/default/content/sound.json';

describe('resolveSoundUrl', () => {
  it('resolves a known cue src to a non-empty string', () => {
    const url = resolveSoundUrl('sound/ambient-drone.wav');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('throws for an unknown cue src', () => {
    expect(() => resolveSoundUrl('sound/nonexistent.wav')).toThrow(
      '[soundAssets]',
    );
  });

  it('resolves every cue src in the default sound manifest', () => {
    const manifest = soundManifestSchema.parse(soundJson);
    for (const cue of manifest.cues) {
      expect(() => resolveSoundUrl(cue.src)).not.toThrow();
    }
  });
});

describe('createBundledFetchBuffer', () => {
  it('returns a function', () => {
    const fn = createBundledFetchBuffer();
    expect(typeof fn).toBe('function');
  });

  it('returned function rejects for an unknown src', async () => {
    const fn = createBundledFetchBuffer();
    await expect(fn('sound/nonexistent.wav')).rejects.toThrow('[soundAssets]');
  });
});
