import { mulberry32 } from '@/engine/rng';
import type { ParsedNarration, NarrationBeat, NarrationWhen } from '@/content/schema/narration';
import { filterByContext, selectVariant } from '@/content/narration';
import { fillTemplate } from '@/content/narration/template';
import type { TemplateContext } from '@/content/narration/template';
import type { SpineBank, MarkSpine } from '@/content/schema';

// Fixed salt so the narration RNG stream never aliases the engine's RNG stream.
// Using a prime-adjacent golden-ratio constant: 0x9e3779b9
const NARRATION_SALT = 0x9e3779b9;

// Separate salt for the spine selection RNG so it never aliases the beat-selection
// stream — the narration RNG stream is identical with or without a spine.
const SPINE_SALT = 0xd76aa478;

// ── Public types ──────────────────────────────────────────────────────────────

export interface DirectorSpineOpts {
  spineBank: SpineBank;
  /** The engine-chosen mansion type for this run. */
  mansionType: string;
}

/**
 * Context supplied to `script()`. The NarrationWhen-compatible fields
 * (`mansionType`, `gameId`, `lane`, `outcome`, `greedy`, `heatBand`) are used
 * for variant filtering; all fields contribute to template fill.
 *
 * Only explicitly-provided (non-undefined) fields participate in variant
 * filtering — absent fields do not exclude variants that carry a `when`
 * constraint for that field.
 */
export type ScriptContext = Partial<NarrationWhen> & {
  /** Crew member names joined into a single string (e.g. "Alice, Bob"). */
  crew?: string;
  /** The name of the crew member attempting this obstacle/scenario. */
  attempter?: string;
  /** The current run total / loot figure as a display string. */
  runTotal?: string;
  /** Current room number as a display string. */
  roomNum?: string;
};

export interface NarrationDirector {
  /** @deprecated Use `script()` instead. Kept for backward-compat during E17.2. */
  next(beat: NarrationBeat, ctx?: Partial<NarrationWhen>): string;
  /**
   * Commits one scripted line for this occurrence of `beat` — advancing the
   * ring buffer so subsequent occurrences differ — and returns it as a
   * template-filled array. Screens hold the array and step through it locally
   * (do not call again for the same occurrence).
   */
  script(beat: NarrationBeat, ctx?: ScriptContext): string[];
  /** The committed mark spine for this run, or null when no spine bank was supplied. */
  readonly spine: MarkSpine | null;
}

// ── Factory ───────────────────────────────────────────────────────────────────

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
 * When `spineOpts` is provided, exactly one `MarkSpine` is committed for the
 * run using a separate RNG seeded with `(seed ^ SPINE_SALT) >>> 0` — the beat
 * RNG stream is unaffected, keeping determinism stable. The committed spine is
 * exposed as `director.spine` and its values (`mark`, `vault`, `security`,
 * `targetHaul`) are automatically merged into the template context on every
 * `script()` call.
 *
 * Framework-free (no React). Deterministic given `seed` + call order.
 */
export function createNarrationDirector(
  bank: ParsedNarration,
  seed: number,
  windowSize?: number,
  spineOpts?: DirectorSpineOpts,
): NarrationDirector {
  const rng = mulberry32(((seed ^ NARRATION_SALT) >>> 0));

  // Commit the spine using a fully isolated RNG stream so the beat selection
  // stream is identical regardless of whether spineOpts is supplied.
  let committedSpine: MarkSpine | null = null;
  if (spineOpts) {
    const spineRng = mulberry32(((seed ^ SPINE_SALT) >>> 0));
    const candidates = spineOpts.spineBank.marks.filter(
      (m) => m.mansionType === spineOpts.mansionType,
    );
    if (candidates.length > 0) {
      const idx = Math.floor(spineRng.next() * candidates.length);
      committedSpine = candidates[idx] ?? null;
    }
  }

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

  function buildTemplateContext(ctx: ScriptContext | undefined): TemplateContext {
    const tpl: TemplateContext = {};

    // Spine values (overridden by ctx if both provide the same token)
    if (committedSpine) {
      tpl.mark = committedSpine.markName;
      tpl.vault = committedSpine.vault;
      tpl.security = committedSpine.security;
      tpl.targetHaul = committedSpine.targetHaul;
    }

    if (ctx === undefined) return tpl;

    // Shared fields (NarrationWhen + template)
    if (ctx.lane !== undefined) tpl.lane = ctx.lane;
    if (ctx.outcome !== undefined) tpl.outcome = ctx.outcome;
    if (ctx.heatBand !== undefined) tpl.heatBand = ctx.heatBand;

    // Template-only fields
    if (ctx.crew !== undefined) tpl.crew = ctx.crew;
    if (ctx.attempter !== undefined) tpl.attempter = ctx.attempter;
    if (ctx.runTotal !== undefined) tpl.runTotal = ctx.runTotal;
    if (ctx.roomNum !== undefined) tpl.roomNum = ctx.roomNum;

    return tpl;
  }

  function script(beat: NarrationBeat, ctx?: ScriptContext): string[] {
    const allVariants = bank[beat];
    if (allVariants.length === 0) return [];

    // Build the NarrationWhen filtering context from only the explicitly-provided
    // fields — absent fields must not exclude variants with constraints for them.
    // Only call filterByContext when at least one filtering field is present; with
    // no filter fields the full variant pool stays available.
    let candidates = allVariants;
    if (ctx !== undefined) {
      const whenCtx: Partial<NarrationWhen> = {};
      let hasFilterField = false;
      if (ctx.mansionType !== undefined) { whenCtx.mansionType = ctx.mansionType; hasFilterField = true; }
      if (ctx.gameId !== undefined) { whenCtx.gameId = ctx.gameId; hasFilterField = true; }
      if (ctx.lane !== undefined) { whenCtx.lane = ctx.lane; hasFilterField = true; }
      if (ctx.outcome !== undefined) { whenCtx.outcome = ctx.outcome; hasFilterField = true; }
      if (ctx.greedy !== undefined) { whenCtx.greedy = ctx.greedy; hasFilterField = true; }
      if (ctx.heatBand !== undefined) { whenCtx.heatBand = ctx.heatBand; hasFilterField = true; }
      if (ctx.restsApply !== undefined) { whenCtx.restsApply = ctx.restsApply; hasFilterField = true; }
      if (hasFilterField) candidates = filterByContext(allVariants, whenCtx);
    }

    const effectiveCandidates = candidates.length > 0 ? candidates : [...allVariants];

    const buf = getBuffer(beat);
    const chosen = selectVariant(effectiveCandidates, buf, () => rng.next());
    if (!chosen) return [];

    recordPick(beat, chosen.id);

    const tplCtx = buildTemplateContext(ctx);
    const lines = typeof chosen.text === 'string' ? [chosen.text] : chosen.text;
    return lines.map(line => fillTemplate(line, tplCtx));
  }

  function next(beat: NarrationBeat, ctx?: Partial<NarrationWhen>): string {
    const lines = script(beat, ctx);
    return lines[0] ?? '';
  }

  return {
    next,
    script,
    get spine(): MarkSpine | null {
      return committedSpine;
    },
  };
}
