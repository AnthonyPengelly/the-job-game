#!/usr/bin/env node
/**
 * Sensor: proves the engine→React import-direction lint rule actually fires.
 *
 * Writes a temporary probe file into src/engine/, runs ESLint on it, asserts a
 * non-zero exit (the rule fired), then deletes the probe. Exits 0 on success
 * (rule confirmed working), exits 1 if the rule failed to fire (broken sensor).
 *
 * Run from the repo root: node scripts/sensors/lint-import-direction.mjs
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

const repoRoot = process.cwd();
const probeFile = resolve(repoRoot, 'src/engine/__lint_probe__.tsx');

// A minimal engine file that imports React — must be rejected by the lint rule.
const probeSource = `import React from 'react';\nexport default React;\n`;
writeFileSync(probeFile, probeSource);

let ruleFired = false;

try {
  execSync(`node node_modules/.bin/eslint "${probeFile}"`, {
    cwd: repoRoot,
    stdio: 'pipe',
  });
  // ESLint exited 0 — the rule did NOT fire; this is a sensor failure.
  console.error(
    'SENSOR FAILED: ESLint accepted an engine→React import without error.\n' +
      'The import-direction rule is not working. Fix eslint.config.js.',
  );
} catch (err) {
  const status = err != null && typeof err === 'object' && 'status' in err ? err.status : -1;

  if (status === 1) {
    // Exit code 1 = lint errors — the rule fired as expected.
    ruleFired = true;
    console.log(
      'Sensor OK: ESLint correctly rejected an engine→React import (import-direction rule works).',
    );
  } else {
    // Exit code 2 = ESLint configuration error; something else went wrong.
    const stderr =
      err != null && typeof err === 'object' && 'stderr' in err ? String(err.stderr) : '';
    console.error(
      `SENSOR FAILED: ESLint exited with unexpected status ${status}.\n` +
        'This likely indicates an ESLint configuration error, not a lint violation.\n' +
        stderr,
    );
  }
} finally {
  if (existsSync(probeFile)) {
    unlinkSync(probeFile);
  }
}

process.exit(ruleFired ? 0 : 1);
