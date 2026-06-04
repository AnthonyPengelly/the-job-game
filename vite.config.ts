import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/engine': resolve(__dirname, 'src/engine'),
      '@/content': resolve(__dirname, 'src/content'),
      '@/minigames': resolve(__dirname, 'src/minigames'),
      '@/console': resolve(__dirname, 'src/console'),
      '@/player-view': resolve(__dirname, 'src/player-view'),
      '@/platform': resolve(__dirname, 'src/platform'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup-jsdom.ts'],
    exclude: ['node_modules/**', 'sim/**'],
  },
});
