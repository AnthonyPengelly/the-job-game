import { useEffect } from 'react';
import { useGameStore } from '@/console/store';
import { useAudio } from './AudioProvider';

/**
 * Subscribes to the store's `heat` and `cfg.heat.hMax`, maps to a 0..1
 * intensity, and calls `engine.setAmbient(intensity)` on every change —
 * including GM overrides and UNDO_LAST, which flow through the same store slice.
 *
 * When no run is active (crew empty) the bed is reset to 0 (idle/drone).
 * Master mute is handled by the engine layer and does not require special
 * treatment here.
 *
 * Must be mounted once inside both AudioProvider and StoreProvider.
 */
export function useAmbientBed(): void {
  const audio = useAudio();
  const heat = useGameStore(s => s.session.present.heat);
  const hMax = useGameStore(s => s.cfg.heat.hMax);
  const crewLength = useGameStore(s => s.session.present.crew.length);

  useEffect(() => {
    if (!audio) return;
    if (crewLength === 0) {
      audio.engine.setAmbient(0);
      return;
    }
    const intensity = Math.max(0, Math.min(1, hMax > 0 ? heat / hMax : 0));
    audio.engine.setAmbient(intensity);
  }, [audio, heat, hMax, crewLength]);
}
