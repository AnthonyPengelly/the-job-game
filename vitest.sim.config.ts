// Dedicated vitest config for the balance harness (npm run sim:check).
// Only runs sim/**/*.sim.ts — excluded from the normal test/check glob.
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@/engine': resolve(__dirname, 'src/engine'),
      '@/content': resolve(__dirname, 'src/content'),
      '@/platform': resolve(__dirname, 'src/platform'),
    },
  },
  test: {
    environment: 'node',
    include: ['sim/**/*.sim.ts'],
    // Allow up to 5 minutes — 20k×5 cells of Monte Carlo is slow but deterministic.
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
