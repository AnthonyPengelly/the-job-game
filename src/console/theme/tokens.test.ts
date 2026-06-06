import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const root = resolve(__dirname, '../../..');

function readThemeFile(name: string): string {
  return readFileSync(resolve(root, 'src/console/theme', name), 'utf8');
}

const CDN_HOSTNAMES = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
];

describe('theme CSS — no CDN references', () => {
  const files = ['tokens.css', 'fonts.css', 'kit.css'];

  for (const file of files) {
    it(`${file} contains no CDN URLs`, () => {
      const content = readThemeFile(file);
      for (const host of CDN_HOSTNAMES) {
        expect(content, `${file} must not reference ${host}`).not.toContain(host);
      }
    });
  }

  it('tokens.css exposes real design-system tokens (--bg-app, --font-display, --heat)', () => {
    const content = readThemeFile('tokens.css');
    expect(content).toContain('--bg-app');
    expect(content).toContain('--font-display');
    expect(content).toContain('--heat');
    expect(content).toContain('--glow-heat');
    expect(content).toContain('--accent-tint');
    expect(content).toContain('--dur-slow');
  });

  it('fonts.css imports fontsource packages (no google CDN)', () => {
    const content = readThemeFile('fonts.css');
    expect(content).toContain('@fontsource/saira-condensed');
    expect(content).toContain('@fontsource/jetbrains-mono');
    expect(content).toContain('@fontsource/ibm-plex-sans');
    expect(content).not.toContain('https://');
  });
});
