#!/usr/bin/env node
/**
 * Sensor: asserts no CDN hostnames appear in the built dist artefacts.
 *
 * Builds the project (if dist/ doesn't exist or is stale) then scans
 * dist/**\/*.{css,js,html} for known CDN hostnames. Exits non-zero with a
 * clear message if any CDN reference is found.
 *
 * Run from the repo root: node scripts/sensors/no-cdn.mjs
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const repoRoot = process.cwd();
const distDir = resolve(repoRoot, 'dist');

const CDN_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
];

/** Walk a directory and return all files matching the extension filter. */
function walk(dir, exts) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full, exts));
    } else if (exts.some(ext => entry.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

// Build if dist doesn't exist.
if (!existsSync(distDir)) {
  console.log('[no-cdn] dist/ not found — running build…');
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
}

const files = walk(distDir, ['.css', '.js', '.html']);

if (files.length === 0) {
  console.error('[no-cdn] ERROR: no .css/.js/.html files found in dist/ — was the build clean?');
  process.exit(1);
}

const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of CDN_PATTERNS) {
    if (content.includes(pattern)) {
      violations.push({ file: file.replace(repoRoot + '/', ''), pattern });
    }
  }
}

if (violations.length > 0) {
  console.error('[no-cdn] FAIL — CDN references found in built artefacts:');
  for (const { file, pattern } of violations) {
    console.error(`  ${file}  →  ${pattern}`);
  }
  console.error('\nAll fonts and icons must be self-hosted (no CDN at runtime).');
  process.exit(1);
}

console.log(`[no-cdn] OK — scanned ${files.length} file(s), no CDN references found.`);
