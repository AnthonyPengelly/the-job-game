/**
 * Formats a loot integer into the display shapes used across the console:
 *   $0  · $999  · $1k  · $5.6k  · $53k  · $137k  · $1.2m
 *
 * One decimal place for k/m; trailing ".0" is stripped (e.g. "$53k" not "$53.0k").
 * Negative values are formatted as "-$Xk" (passthrough guard for override inputs).
 */
export function formatLoot(n: number): string {
  if (n < 0) return `-${formatLoot(-n)}`;
  if (n >= 1_000_000) {
    const val = (n / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `$${val}m`;
  }
  if (n >= 1_000) {
    const val = (n / 1_000).toFixed(1).replace(/\.0$/, '');
    return `$${val}k`;
  }
  return `$${n}`;
}
