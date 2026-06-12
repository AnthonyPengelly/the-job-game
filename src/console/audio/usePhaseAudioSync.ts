import { useEffect } from 'react';
import { useGameStore } from '@/console/store';
import { useAudio } from './AudioProvider';

/**
 * Stops looping cues that don't belong to the current run phase whenever the
 * phase changes — the GM's helicopter must not chase the crew onto the result
 * screen (playtest wave 3). One-shots play out naturally; loops whose manifest
 * `phases` include the new phase keep running.
 *
 * Must be mounted once inside both AudioProvider and StoreProvider.
 */
export function usePhaseAudioSync(): void {
  const audio = useAudio();
  const phase = useGameStore(s => s.session.present.phase);

  useEffect(() => {
    if (!audio) return;
    audio.engine.stopLoopsForPhase(phase);
  }, [audio, phase]);
}
