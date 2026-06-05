import { useState, useEffect } from 'react';
import type { PlayerViewSlice } from './channel';
import { subscribeToSlice } from './channel';
import { DefuseRulebook } from './screens/DefuseRulebook';
import { GetawayDisplay } from './screens/GetawayDisplay';

/** Isolated player-facing React surface. Never imports @/console. */
export function PlayerViewApp(): JSX.Element {
  const [slice, setSlice] = useState<PlayerViewSlice>({ kind: 'idle' });

  useEffect(() => {
    return subscribeToSlice(setSlice);
  }, []);

  if (slice.kind === 'defuse-rulebook') {
    return <DefuseRulebook slice={slice} />;
  }

  if (slice.kind === 'getaway') {
    return <GetawayDisplay slice={slice} />;
  }

  return (
    <div data-testid="player-view-idle">
      <p>Waiting for game...</p>
    </div>
  );
}
