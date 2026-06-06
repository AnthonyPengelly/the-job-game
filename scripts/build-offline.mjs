#!/usr/bin/env node
/**
 * Offline build script — produces self-contained HTML for file:// delivery.
 *
 * Vite's multi-page input + vite-plugin-singlefile are incompatible because
 * inlineDynamicImports:true (required for single-file output) is only allowed
 * when there is a single Rollup entry point.  We work around this by running
 * two sequential single-entry builds, preserving the first build's output for
 * the second pass (emptyOutDir:false).
 *
 * Settings applied per-pass (mirrors vite-plugin-singlefile's recommended
 * build config):
 *   base: './'           — relative asset references (safe for file://)
 *   cssCodeSplit: false  — one CSS file per entry; the plugin inlines it
 *   assetsInlineLimit    — always inline so fonts become data: URIs in CSS
 *   assetsDir: ''        — assets land in dist/ root (plugin deletes them)
 *   inlineDynamicImports — single entry only; merges all JS into one chunk
 *   deleteInlinedFiles   — plugin removes the standalone JS/CSS after inlining
 *
 * Run from repo root: node scripts/build-offline.mjs
 */

import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const configFile = resolve(root, 'vite.config.ts');

const sharedBuild = {
  base: './',
  cssCodeSplit: false,
  assetsInlineLimit: () => true,
  assetsDir: '',
  chunkSizeWarningLimit: 100_000_000,
};

const singleFilePlugin = viteSingleFile({ useRecommendedBuildConfig: false });

console.log('\n[build-offline] pass 1/2 — GM console (index.html)…');
await build({
  configFile,
  base: './',
  plugins: [singleFilePlugin],
  build: {
    ...sharedBuild,
    rollupOptions: {
      input: { main: resolve(root, 'index.html') },
      output: { inlineDynamicImports: true },
    },
  },
});

console.log('\n[build-offline] pass 2/2 — player view (player.html)…');
await build({
  configFile,
  base: './',
  plugins: [singleFilePlugin],
  build: {
    ...sharedBuild,
    emptyOutDir: false,
    rollupOptions: {
      input: { player: resolve(root, 'player.html') },
      output: { inlineDynamicImports: true },
    },
  },
});

console.log('\n[build-offline] done — dist/index.html and dist/player.html are self-contained.');
