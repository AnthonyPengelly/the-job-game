import type { RunPhase } from '@/engine';
import type { ParsedSoundManifest, SoundCue } from '@/content/schema';

// Action-bar shows only these channels — compact, action-oriented, not ambient.
const CONTEXTUAL_CHANNELS = new Set<string>(['danger', 'sting', 'finale']);

/**
 * Pure deriver: returns the small contextual cue set for the action-bar
 * quick-cue row. Subset of phase-relevant cues filtered to danger/sting/finale
 * channels. Preserves manifest order.
 */
export function actionBarCues(phase: RunPhase, manifest: ParsedSoundManifest): SoundCue[] {
  return manifest.cues.filter(
    cue => cue.phases.includes(phase) && CONTEXTUAL_CHANNELS.has(cue.channel),
  );
}
