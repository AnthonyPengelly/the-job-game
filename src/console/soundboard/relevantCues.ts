import type { RunPhase } from '@/engine';
import type { ParsedSoundManifest, SoundCue, SoundChannel } from '@/content/schema';

/** Cues grouped by channel — only channels with ≥1 relevant cue are present. */
export type CueGroups = Partial<Record<SoundChannel, SoundCue[]>>;

/**
 * Pure deriver: given the current run phase and the sound manifest, returns the
 * subset of cues grouped by channel whose `phases` list includes `phase`.
 *
 * Channels absent from the result have no cues relevant to the current phase.
 * The ordering within each group preserves manifest order.
 */
export function relevantCues(phase: RunPhase, manifest: ParsedSoundManifest): CueGroups {
  const result: CueGroups = {};
  for (const cue of manifest.cues) {
    if ((cue.phases as string[]).includes(phase)) {
      if (result[cue.channel] === undefined) {
        result[cue.channel] = [];
      }
      result[cue.channel]!.push(cue);
    }
  }
  return result;
}
