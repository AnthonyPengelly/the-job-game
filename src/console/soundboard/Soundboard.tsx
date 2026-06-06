import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { useAudio } from '@/console/audio';
import type { SoundChannel } from '@/content/schema';
import { relevantCues } from './relevantCues';

// ── Channel display config ────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<SoundChannel, string> = {
  ambient: 'Ambient',
  heistSfx: 'Heist SFX',
  sting: 'Stings',
  danger: 'Danger',
  finale: 'Finale',
};

const CHANNEL_ORDER: SoundChannel[] = ['ambient', 'heistSfx', 'sting', 'danger', 'finale'];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Context-sensitive soundboard for the GM.
 *
 * Renders only the cue buttons relevant to the current run phase (derived from
 * the manifest's `phases` field per cue). Looping cues toggle on/off; one-shot
 * cues fire immediately. Includes a master mute/volume control so the GM is
 * never stuck with sound on.
 *
 * Returns null when there is no AudioProvider above this component in the tree,
 * or when the current phase has no relevant cues.
 */
export function Soundboard(): JSX.Element | null {
  const handle = useAudio();
  const phase = useGameStore(s => s.session.present.phase);

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [activeCues, setActiveCues] = useState<ReadonlySet<string>>(new Set());

  if (!handle) return null;

  const { engine, manifest } = handle;
  const groups = relevantCues(phase, manifest);

  const hasAnyCues = CHANNEL_ORDER.some(ch => (groups[ch]?.length ?? 0) > 0);
  if (!hasAnyCues) return null;

  function handleToggleMute() {
    const next = !muted;
    setMuted(next);
    engine.mute(next);
  }

  function handleVolumeChange(v: number) {
    setVolume(v);
    engine.setMasterGain(v);
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
