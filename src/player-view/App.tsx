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
    return (
      <div className="pv">
        <DefuseRulebook slice={slice} />
      </div>
    );
  }

  if (slice.kind === 'getaway') {
    return (
      <div className="pv">
        <GetawayDisplay slice={slice} />
      </div>
    );
  }

  return (
    <div className="pv" data-testid="player-view-idle">
      <div className="pv-inner" style={{ alignItems: 'center' }}>
        <p className="pv-clock-label">Waiting for game&hellip;</p>
      </div>
    </div>
  );
}
