import { describe, it, expect } from 'vitest';
import { statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveSoundUrl, createBundledFetchBuffer } from './soundAssets';
import { soundManifestSchema } from '@/content/schema';
import soundJson from '../../../presets/default/content/sound.json';

// WAV header is 44 bytes; any real PCM data pushes the file well above this.
// Threshold chosen to comfortably exceed the 44-byte empty-stub size so a
// future regression back to silent stubs fails loudly.
const MIN_REAL_ASSET_BYTES = 1000;

const SOUNDS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'sounds');

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

  it('every manifest cue maps to a non-trivial WAV file on disk (> 1000 bytes)', () => {
    const manifest = soundManifestSchema.parse(soundJson);
    for (const cue of manifest.cues) {
      const filename = cue.src.replace('sound/', '');
      const filepath = join(SOUNDS_DIR, filename);
      const stat = statSync(filepath);
      expect(stat.size, `${filename} is too small — stub file not replaced?`).toBeGreaterThan(
        MIN_REAL_ASSET_BYTES,
      );
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
