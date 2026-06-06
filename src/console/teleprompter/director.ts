import { mulberry32 } from '@/engine/rng';
import type { ParsedNarration, NarrationBeat, NarrationWhen } from '@/content/schema/narration';
import { filterByContext, selectVariant } from '@/content/narration';

// Fixed salt so the narration RNG stream never aliases the engine's RNG stream.
// Using a prime-adjacent golden-ratio constant: 0x9e3779b9
const NARRATION_SALT = 0x9e3779b9;

export interface NarrationDirector {
  next(beat: NarrationBeat, ctx?: Partial<NarrationWhen>): string;
}

/**
 * Creates a narration director that owns its own `mulberry32` seeded from
 * `(seed ^ NARRATION_SALT) >>> 0` — reproducible from the run seed but never
 * sharing or advancing the engine's RNG stream.
 *
 * Each beat has its own recently-used ring buffer of size
 * `Math.floor(bank[beat].length / 2)` (or `windowSize` if supplied).
 * This guarantees no repeat within a typical run's call count for each beat,
 * because the window is computed from the full beat pool rather than the
 * context-filtered pool.
 *
 * Framework-free (no React). Deterministic given `seed` + call order.
 */
export function createNarrationDirector(
  bank: ParsedNarration,
  seed: number,
  windowSize?: number,
): NarrationDirector {
  const rng = mulberry32(((seed ^ NARRATION_SALT) >>> 0));

  const recentBuffers: Partial<Record<NarrationBeat, string[]>> = {};

  function getBuffer(beat: NarrationBeat): string[] {
    if (recentBuffers[beat] === undefined) recentBuffers[beat] = [];
    return recentBuffers[beat];
  }

  function recordPick(beat: NarrationBeat, id: string): void {
    const maxWindow = windowSize ?? Math.floor(bank[beat].length / 2);
    const buf = getBuffer(beat);
    buf.push(id);
    if (buf.length > maxWindow) buf.shift();
  }

  function next(beat: NarrationBeat, ctx?: Partial<NarrationWhen>): string {
    const allVariants = bank[beat];
    if (allVariants.length === 0) return '';

    const candidates =
      ctx !== undefined ? filterByContext(allVariants, ctx) : [...allVariants];

    const effectiveCandidates = candidates.length > 0 ? candidates : [...allVariants];

    const buf = getBuffer(beat);
    const chosen = selectVariant(effectiveCandidates, buf, () => rng.next());
    if (!chosen) return '';

    recordPick(beat, chosen.id);
    return chosen.text;
  }

  return { next };
}
