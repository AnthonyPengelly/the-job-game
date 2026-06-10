import { useState } from 'react';
import { useActionBarSlot } from './actionBarSlot';
import { useAudio } from '@/console/audio';
import { useGameStore } from '@/console/store';
import { actionBarCues } from './actionBarCues';

/**
 * The cockpit bottom action bar.
 *
 * Reads left/right/note from the ActionBarSlot context published by the
 * active phase screen's <ActionBar> component. Three zones:
 *   left  — back / secondary CTA
 *   cues  — contextual sound shortcuts (danger/sting/finale cues for the phase)
 *   right — note text + primary CTA
 *
 * The cues zone shows a small phase-contextual set. Looping cues toggle
 * on/off; one-shots fire on click. Cues that failed to load are shown as
 * disabled with a "missing" affordance instead of silently no-oping.
 */
export function CockpitActionBar() {
  const { left, right, note } = useActionBarSlot();
  const handle = useAudio();
  const phase = useGameStore(s => s.session.present.phase);
  const [activeCues, setActiveCues] = useState<ReadonlySet<string>>(new Set());

  const contextualCues = handle ? actionBarCues(phase, handle.manifest) : [];

  function handleCueClick(cueId: string, loop: boolean) {
    if (!handle) return;
    const { engine } = handle;
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
    <div className="cockpit-actionbar" data-testid="cockpit-actionbar">
      <div className="grp">{left}</div>
      <div className="grp-cues">
        {contextualCues.length > 0 && (
          <>
            <span className="cues-label">Cues</span>
            {contextualCues.map(cue => {
              const available = handle?.engine.isCueAvailable(cue.id) ?? false;
              const isActive = activeCues.has(cue.id);
              const isLooping = cue.loop === true;
              const icon = isLooping ? (isActive ? '■' : '▶') : '▶';
              return (
                <button
                  key={cue.id}
                  data-testid={`action-cue-${cue.id}`}
                  className={[
                    'cue',
                    isActive ? 'playing' : '',
                    !available ? 'missing' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleCueClick(cue.id, isLooping)}
                  disabled={!available}
                  aria-pressed={isLooping ? isActive : undefined}
                  title={available ? cue.id : `${cue.id} (unavailable)`}
                >
                  <span className="cue-icon">{icon}</span>
                  <span className="cue-label">{cue.id}</span>
                  {!available && <span className="cue-missing-badge">missing</span>}
                </button>
              );
            })}
          </>
        )}
      </div>
      <div className="grp">
        {note !== undefined && (
          <span className="cockpit-actionbar-note">{note}</span>
        )}
        {right}
      </div>
    </div>
  );
}
