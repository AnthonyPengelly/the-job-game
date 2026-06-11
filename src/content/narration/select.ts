// Pure variant selector — no engine imports, no React.
// The rand function is injected so the caller fully controls the RNG stream.

import type { NarrationVariant, NarrationWhen } from '@/content/schema/narration';

/**
 * Keeps variants whose `when` condition (if present) matches the supplied
 * partial context. A variant with no `when` always passes.
 */
export function filterByContext(
  variants: readonly NarrationVariant[],
  ctx: Partial<NarrationWhen>,
): NarrationVariant[] {
  return variants.filter((v) => {
    const w = v.when;
    if (!w) return true;
    if (w.mansionType !== undefined && w.mansionType !== ctx.mansionType) return false;
    if (w.gameId !== undefined && w.gameId !== ctx.gameId) return false;
    if (w.lane !== undefined && w.lane !== ctx.lane) return false;
    if (w.outcome !== undefined && w.outcome !== ctx.outcome) return false;
    if (w.greedy !== undefined && w.greedy !== ctx.greedy) return false;
    if (w.heatBand !== undefined && w.heatBand !== ctx.heatBand) return false;
    if (w.restsApply !== undefined && w.restsApply !== ctx.restsApply) return false;
    return true;
  });
}

/**
 * Picks one variant from `variants`, preferring those whose ids are absent from
 * `recentIds`. Falls back to the full candidate set when every candidate is
 * recent (small pool exhausted), so it never throws. Returns `undefined` only
 * when `variants` is empty.
 *
 * @param variants  Already-filtered candidates for this beat.
 * @param recentIds Ring buffer of recently-used variant ids for this beat.
 * @param rand      Injected RNG function — returns a float in [0, 1).
 */
export function selectVariant(
  variants: readonly NarrationVariant[],
  recentIds: readonly string[],
  rand: () => number,
): NarrationVariant | undefined {
  if (variants.length === 0) return undefined;

  const recent = new Set(recentIds);
  const fresh = variants.filter((v) => !recent.has(v.id));
  const pool = fresh.length > 0 ? fresh : variants;

  const index = Math.floor(rand() * pool.length);
  return pool[index];
}
