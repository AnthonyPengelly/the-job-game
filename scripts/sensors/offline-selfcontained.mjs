#!/usr/bin/env node
/**
 * Sensor: asserts each built HTML entry (dist/index.html, dist/player.html) is
 * genuinely self-contained for file:// delivery.
 *
 * Checks performed on every HTML entry:
 *   1. No <script> tag with a src= attribute (external JS module).
 *   2. No <link> tag with an href= attribute (external CSS or preload).
 *   3. No src="/" or href="/" in any HTML tag (absolute-path asset reference).
 *   4. No http(s):// URL in any HTML attribute value (CDN asset).
 *   5. No runtime fetch("sound/…") / fetch('sound/…') — file-path audio fetch
 *      that would be blocked under file://.
 *
 * Always builds from current source before scanning so it can never false-pass
 * against a stale dist/ left over from a previous pipeline step.
 *
 * Run from the repo root: node scripts/sensors/offline-selfcontained.mjs
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

const repoRoot = process.cwd();
const distDir = resolve(repoRoot, 'dist');

/** The HTML entries that must be self-contained. */
const REQUIRED_ENTRIES = ['index.html', 'player.html'];

/**
 * Checks and their descriptions.  Each entry: { label, pattern, description }
 * pattern is a RegExp tested against the full file content.
 */
const CHECKS = [
  {
    label: 'external-script-src',
    // <script with a src= attribute (may be followed by other attrs or whitespace)
    pattern: /<script\b[^>]*\bsrc\s*=/i,
    description: '<script src=…> found — external JS will fail under file://',
  },
  {
    label: 'external-link-href',
    // <link with an href= attribute
    pattern: /<link\b[^>]*\bhref\s*=/i,
    description: '<link href=…> found — external CSS/font will fail under file://',
  },
  {
    label: 'absolute-path-src',
    // src="/" or src='/' in HTML attribute (root-absolute asset path)
    pattern: /\bsrc\s*=\s*["']\/(?!\/)/,
    description: 'src="/" absolute-path asset reference found — will 404 under file://',
  },
  {
    label: 'absolute-path-href',
    // href="/" or href='/' in HTML attribute (root-absolute asset path)
    pattern: /\bhref\s*=\s*["']\/(?!\/)/,
    description: 'href="/" absolute-path asset reference found — will 404 under file://',
  },
  {
    label: 'cdn-url-in-attribute',
    // http(s):// appearing as an attribute value (src=, href=, action=, etc.)
    // Targets the pattern: attr="https://... or attr='https://...
    pattern: /(?:src|href|action|data-src)\s*=\s*["']https?:\/\//i,
    description: 'http(s):// CDN URL in HTML attribute — external asset load under file://',
  },
  {
    label: 'runtime-sound-fetch',
    // fetch("sound/...") or fetch('sound/...') — a literal file-path audio fetch
    // that would be CORS-blocked under file://.  Resolved data: URIs are fine
    // and do not match this pattern.
    pattern: /fetch\s*\(\s*["'](?:sound\/|\.\/sound\/)/,
    description:
      'fetch("sound/…") file-path found — audio fetch will be blocked under file://; ' +
      'sound assets must be resolved to data: URIs before fetching',
  },
];

// Always build from current source so the scan reflects the actual output.
console.log('[offline-selfcontained] building from current source…');
execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });

// Verify the required HTML entries exist.
const missing = REQUIRED_ENTRIES.filter(name => {
  try {
    statSync(join(distDir, name));
    return false;
  } catch {
    return true;
  }
});

if (missing.length > 0) {
  console.error('[offline-selfcontained] ERROR: expected HTML entries not found in dist/:');
  for (const name of missing) {
    console.error(`  dist/${name}`);
  }
  process.exit(1);
}

const violations = [];

for (const name of REQUIRED_ENTRIES) {
  const filePath = join(distDir, name);
  const content = readFileSync(filePath, 'utf8');

  for (const check of CHECKS) {
    if (check.pattern.test(content)) {
      violations.push({ file: `dist/${name}`, check: check.label, description: check.description });
    }
  }
}

if (violations.length > 0) {
  console.error('[offline-selfcontained] FAIL — self-containment violations found:');
  for (const { file, check, description } of violations) {
    console.error(`  ${file}  [${check}]  ${description}`);
  }
  console.error(
    '\nAll built HTML entries must be self-contained for file:// delivery.\n' +
      'See docs/OFFLINE-BUILD.md (E12.5) and task E12.1–E12.3 for context.',
  );
  process.exit(1);
}

console.log(
  `[offline-selfcontained] OK — ${REQUIRED_ENTRIES.length} HTML entries are self-contained ` +
    `(no external scripts, links, absolute paths, CDN URLs, or file-path sound fetches).`,
);
