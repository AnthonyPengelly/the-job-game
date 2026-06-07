import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { useAudio, useAudioSettings } from '@/console/audio';
import type { ParsedSoundManifest, SoundChannel } from '@/content/schema';
import { relevantCues } from './relevantCues';
import type { CueGroups } from './relevantCues';

// ── Channel display config ────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<SoundChannel, string> = {
  ambient: 'Ambient',
  heistSfx: 'Heist SFX',
  sting: 'Stings',
  danger: 'Danger',
  finale: 'Finale',
};

const CHANNEL_ORDER: SoundChannel[] = ['ambient', 'heistSfx', 'sting', 'danger', 'finale'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Groups every cue in the manifest by channel, ignoring phase restrictions. */
function groupAllCues(manifest: ParsedSoundManifest): CueGroups {
  const result: CueGroups = {};
  for (const cue of manifest.cues) {
    if (result[cue.channel] === undefined) result[cue.channel] = [];
    result[cue.channel]!.push(cue);
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SoundboardProps {
  /**
   * When true, shows all channels and cues regardless of current run phase.
   * Used by the ToolRail drawer (the full board). The phase-contextual quick-cue
   * row in the action bar (E13.7) uses the default phase-filtered mode.
   */
  fullBoard?: boolean;
}

/**
 * GM soundboard.
 *
 * In default mode (fullBoard=false) renders only the cues relevant to the
 * current run phase (derived from the manifest's `phases` field per cue).
 * In fullBoard mode renders all channels' cues regardless of phase.
 *
 * Looping cues toggle on/off; one-shot cues fire immediately.
 * Master mute/volume are sourced from the shared AudioSettingsContext so that
 * the Soundboard drawer and the Settings dialog always agree on the audio state.
 *
 * Returns null when there is no AudioProvider above this component in the tree,
 * or when there are no cues to display.
 */
export function Soundboard({ fullBoard = false }: SoundboardProps): JSX.Element | null {
  const handle = useAudio();
  const audioSettings = useAudioSettings();
  const phase = useGameStore(s => s.session.present.phase);
  const [activeCues, setActiveCues] = useState<ReadonlySet<string>>(new Set());

  if (!handle) return null;

  const { engine, manifest } = handle;
  const muted = audioSettings?.muted ?? false;
  const volume = audioSettings?.volume ?? 1;
  const setMuted = audioSettings?.setMuted ?? (() => { /* no-op without AudioSettingsContext */ });
  const setVolume = audioSettings?.setVolume ?? (() => { /* no-op without AudioSettingsContext */ });

  const groups = fullBoard ? groupAllCues(manifest) : relevantCues(phase, manifest);

  const hasAnyCues = CHANNEL_ORDER.some(ch => (groups[ch]?.length ?? 0) > 0);
  if (!hasAnyCues) return null;

  function handleToggleMute() {
    setMuted(!muted);
  }

  function handleVolumeChange(v: number) {
    setVolume(v);
  }

  function handleCueClick(cueId: string, loop: boolean) {
    if (loop) {
      if (activeCues.has(cueId)) {
        engine.stop(cueId);
        setActiveCues(prev => {
          const next = new Set(prev);
          next.delete(cueId);
          return next;
        });
      } else {
        engine.play(cueId);
        setActiveCues(prev => new Set([...prev, cueId]));
      }
    } else {
      engine.play(cueId);
    }
  }

  return (
    <div data-testid="soundboard">
      <div data-testid="soundboard-controls">
        <button
          data-testid="btn-master-mute"
          onClick={handleToggleMute}
          aria-pressed={muted}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <label>
          {'Volume '}
          <input
            data-testid="input-master-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => handleVolumeChange(parseFloat(e.target.value))}
          />
        </label>
      </div>

      <div data-testid="soundboard-groups">
        {CHANNEL_ORDER.map(channel => {
          const cues = groups[channel];
          if (!cues || cues.length === 0) return null;
          return (
            <div key={channel} data-testid={`soundboard-group-${channel}`}>
              <h3>{CHANNEL_LABELS[channel]}</h3>
              <div>
                {cues.map(cue => {
                  const isActive = activeCues.has(cue.id);
                  const isLooping = cue.loop === true;
                  return (
                    <button
                      key={cue.id}
                      data-testid={`btn-cue-${cue.id}`}
                      onClick={() => handleCueClick(cue.id, isLooping)}
                      aria-pressed={isLooping ? isActive : undefined}
                    >
                      {isLooping
                        ? (isActive ? `■ ${cue.id}` : `▶ ${cue.id}`)
                        : `▶ ${cue.id}`}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
