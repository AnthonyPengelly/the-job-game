import { useState } from 'react';
import type { Lane } from '@/engine';
import type { BoostHook, CommittedPlayer } from '@/minigames/contract';

export interface BoostButtonProps<ChallengeState, Params> {
  hook: BoostHook<ChallengeState, Params>;
  /** All lanes the game covers — eligibility fires when the player holds any of these. */
  gameLanes: Lane[];
  committed: CommittedPlayer[];
  onFire: (hook: BoostHook<ChallengeState, Params>) => void;
}

/**
 * Renders only when a committed player holds a power-up in any of the game's lanes.
 * Fires onFire exactly once, then disables.
 * Returns null when nobody committed qualifies (MINIGAMES.md §4).
 */
export function BoostButton<ChallengeState, Params>({
  hook,
  gameLanes,
  committed,
  onFire,
}: BoostButtonProps<ChallengeState, Params>): JSX.Element | null {
  const [used, setUsed] = useState(false);

  const holders = committed.filter((p) => gameLanes.some((l) => p.powerUps[l] === true));
  if (holders.length === 0) return null;
  // Any eligible holder may shout it (once per game) — name them all.
  const holderNames = holders.map((p) => p.name).filter(Boolean).join(' or ');

  function handleClick() {
    if (used) return;
    setUsed(true);
    onFire(hook);
  }

  return (
    <button
      type="button"
      className="mg-boost-btn"
      data-testid={`boost-${hook.lane}`}
      disabled={used}
      onClick={handleClick}
    >
      {hook.label}
      {holderNames ? ` (${holderNames})` : ''}
    </button>
  );
}
