import { describe, it, expect } from 'vitest';
import type { EngineLayer } from '@/engine';

describe('vitest + alias smoke test', () => {
  it('resolves @/engine alias and passes', () => {
    const layer: EngineLayer = 'engine';
    expect(layer).toBe('engine');
  });
});
