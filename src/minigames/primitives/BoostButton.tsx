import { useState } from 'react';
import type { BoostHook, CommittedPlayer } from '@/minigames/contract';

export interface BoostButtonProps<ChallengeState, Params> {
  hook: BoostHook<ChallengeState, Params>;
  committed: CommittedPlayer[];
  onFire: (hook: BoostHook<ChallengeState, Params>) => void;
}

/**
 * Renders only when a committed player holds the lane power-up for the hook's lane.
 * Fires onFire exactly once, then disables.
 * Returns null when nobody committed holds the power-up (MINIGAMES.md §4).
 */
export function BoostButton<ChallengeState, Params>({
  hook,
  committed,
  onFire,
}: BoostButtonProps<ChallengeState, Params>): JSX.Element | null {
  const [used, setUsed] = useState(false);

  const holder = committed.find((p) => p.powerUps[hook.lane] === true);
  if (!holder) return null;

  function handleClick() {
    if (used) return;
    setUsed(true);
    onFire(hook);
  }

  return (
    <button
      data-testid={`boost-${hook.lane}`}
      disabled={used}
      onClick={handleClick}
    >
      {hook.label}
      {holder.name ? ` (${holder.name})` : ''}
    </button>
  );
}
