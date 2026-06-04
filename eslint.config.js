import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

// Relative-path patterns that match cross-layer climbs at depths 1–3.
// minimatch's ** skips dot-prefixed segments (e.g. ".."), so explicit depths
// are the only reliable way to catch ../content, ../../content, etc.
function relPats(layerName) {
  return [
    `../${layerName}`,
    `../${layerName}/**`,
    `../../${layerName}`,
    `../../${layerName}/**`,
    `../../../${layerName}`,
    `../../../${layerName}/**`,
  ];
}

export default tseslint.config(
  // ── Ignores ─────────────────────────────────────────────────────────
  { ignores: ['dist/**', 'node_modules/**'] },

  // ── Base: TypeScript for all source files (no React plugins) ────────
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // ── Sim: balance harness — pure TypeScript, Node.js context ─────────
  {
    files: ['sim/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },

  // ── React surfaces: hooks + refresh rules for UI layers only ────────
  {
    files: [
      'src/console/**/*.{ts,tsx}',
      'src/player-view/**/*.{ts,tsx}',
      'src/minigames/**/*.{ts,tsx}',
      'src/main.tsx',
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ── Engine: pure TS — no React, no DOM, no timers, no other layers ──
  {
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      // Timer and DOM globals are forbidden in the engine (architecture §3).
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: 'Engine must not use timers — pass time explicitly.' },
        { name: 'setInterval', message: 'Engine must not use timers — pass time explicitly.' },
        { name: 'clearTimeout', message: 'Engine must not use timers — pass time explicitly.' },
        { name: 'clearInterval', message: 'Engine must not use timers — pass time explicitly.' },
        {
          name: 'requestAnimationFrame',
          message: 'Engine must not use requestAnimationFrame (DOM only).',
        },
        {
          name: 'cancelAnimationFrame',
          message: 'Engine must not use cancelAnimationFrame (DOM only).',
        },
        { name: 'document', message: 'Engine must not access the DOM.' },
        { name: 'window', message: 'Engine must not access the global window object.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // ── Bare-package / @/-alias blocks ───────────────────────
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'Engine must not import React (engine is pure TS, no DOM).',
            },
            {
              group: ['@/content', '@/content/**'],
              message: 'Engine must not import the content layer.',
            },
            {
              group: ['@/minigames', '@/minigames/**'],
              message: 'Engine must not import the minigames layer.',
            },
            {
              group: ['@/console', '@/console/**'],
              message: 'Engine must not import the console layer.',
            },
            {
              group: ['@/player-view', '@/player-view/**'],
              message: 'Engine must not import the player-view layer.',
            },
            {
              group: ['@/platform', '@/platform/**'],
              message: 'Engine must not import the platform layer.',
            },
            // ── Relative cross-layer climbs ───────────────────────────
            { group: relPats('content'), message: 'Engine must not import the content layer.' },
            { group: relPats('minigames'), message: 'Engine must not import the minigames layer.' },
            { group: relPats('console'), message: 'Engine must not import the console layer.' },
            {
              group: relPats('player-view'),
              message: 'Engine must not import the player-view layer.',
            },
            { group: relPats('platform'), message: 'Engine must not import the platform layer.' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="Math"][property.name="random"]',
          message: 'Engine must not use Math.random — use the seeded RNG (src/engine/rng.ts).',
        },
        {
          selector: 'MemberExpression[object.name="Date"][property.name="now"]',
          message: 'Engine must not use Date.now — pass timestamps explicitly.',
        },
      ],
    },
  },

  // ── Content: may import @/engine (types) only ───────────────────────
  {
    files: ['src/content/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'Content layer must not import React.',
            },
            {
              group: ['@/minigames', '@/minigames/**'],
              message: 'Content must not import the minigames layer.',
            },
            {
              group: ['@/console', '@/console/**'],
              message: 'Content must not import the console layer.',
            },
            {
              group: ['@/player-view', '@/player-view/**'],
              message: 'Content must not import the player-view layer.',
            },
            {
              group: ['@/platform', '@/platform/**'],
              message: 'Content must not import the platform layer.',
            },
            { group: relPats('minigames'), message: 'Content must not import the minigames layer.' },
            { group: relPats('console'), message: 'Content must not import the console layer.' },
            {
              group: relPats('player-view'),
              message: 'Content must not import the player-view layer.',
            },
            { group: relPats('platform'), message: 'Content must not import the platform layer.' },
          ],
        },
      ],
    },
  },

  // ── Minigames: may import engine, content, platform — not surfaces ───
  {
    files: ['src/minigames/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/console', '@/console/**'],
              message: 'Minigames must not import the console layer.',
            },
            {
              group: ['@/player-view', '@/player-view/**'],
              message: 'Minigames must not import the player-view layer.',
            },
            { group: relPats('console'), message: 'Minigames must not import the console layer.' },
            {
              group: relPats('player-view'),
              message: 'Minigames must not import the player-view layer.',
            },
          ],
        },
      ],
    },
  },

  // ── Console: may import everything below — not player-view ──────────
  {
    files: ['src/console/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/player-view', '@/player-view/**'],
              message: 'Console must not import the player-view layer.',
            },
            {
              group: relPats('player-view'),
              message: 'Console must not import the player-view layer.',
            },
          ],
        },
      ],
    },
  },

  // ── Player-view: may import engine types, platform, content — not console ─
  {
    files: ['src/player-view/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/console', '@/console/**'],
              message: 'Player-view must not import the console layer.',
            },
            {
              group: relPats('console'),
              message: 'Player-view must not import the console layer.',
            },
          ],
        },
      ],
    },
  },

  // ── Platform: may import engine types, content — not surfaces, not minigames ─
  {
    files: ['src/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/console', '@/console/**'],
              message: 'Platform must not import the console layer.',
            },
            {
              group: ['@/player-view', '@/player-view/**'],
              message: 'Platform must not import the player-view layer.',
            },
            {
              group: ['@/minigames', '@/minigames/**'],
              message: 'Platform must not import the minigames layer.',
            },
            { group: relPats('console'), message: 'Platform must not import the console layer.' },
            {
              group: relPats('player-view'),
              message: 'Platform must not import the player-view layer.',
            },
            {
              group: relPats('minigames'),
              message: 'Platform must not import the minigames layer.',
            },
          ],
        },
      ],
    },
  },

  // ── Prettier: must be last to disable conflicting formatting rules ───
  prettierConfig,
);
