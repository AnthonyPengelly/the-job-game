import { describe, it, expect } from 'vitest';
import { formatLoot } from './format';

describe('formatLoot', () => {
  it('formats zero as $0', () => {
    expect(formatLoot(0)).toBe('$0');
  });

  it('formats integers under 1000 as $N', () => {
    expect(formatLoot(1)).toBe('$1');
    expect(formatLoot(999)).toBe('$999');
    expect(formatLoot(500)).toBe('$500');
  });

  it('formats 1000 as $1k', () => {
    expect(formatLoot(1000)).toBe('$1k');
  });

  it('formats thousands with one decimal, trailing .0 trimmed', () => {
    expect(formatLoot(5600)).toBe('$5.6k');
    expect(formatLoot(53000)).toBe('$53k');
    expect(formatLoot(137000)).toBe('$137k');
    expect(formatLoot(1500)).toBe('$1.5k');
    expect(formatLoot(10000)).toBe('$10k');
    expect(formatLoot(99900)).toBe('$99.9k');
    expect(formatLoot(999000)).toBe('$999k');
  });

  it('formats millions with one decimal, trailing .0 trimmed', () => {
    expect(formatLoot(1_200_000)).toBe('$1.2m');
    expect(formatLoot(1_000_000)).toBe('$1m');
    expect(formatLoot(2_500_000)).toBe('$2.5m');
    expect(formatLoot(10_000_000)).toBe('$10m');
  });

  it('handles negative values as guard case', () => {
    expect(formatLoot(-1000)).toBe('-$1k');
    expect(formatLoot(-500)).toBe('-$500');
    expect(formatLoot(-1_500_000)).toBe('-$1.5m');
  });
});
