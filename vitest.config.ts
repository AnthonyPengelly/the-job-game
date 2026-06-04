import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
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
  },
});
