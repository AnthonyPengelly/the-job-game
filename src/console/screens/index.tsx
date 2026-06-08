import type { RunPhase } from '@/engine';
import { useGameStore } from '@/console/store';
import { Setup } from './Setup';
import { Briefing } from './Briefing';
import { ObstacleRoom } from './ObstacleRoom';
import { MinigameHost } from './MinigameHost';
import { ScenarioRoom } from './ScenarioRoom';
import { Spoils } from './Spoils';
import { Offer } from './Offer';
import { Getaway } from './Getaway';
import { Result } from './Result';

// ── Room router ───────────────────────────────────────────────────────────────

/**
 * Reads currentRoom from the store and renders the appropriate room screen.
 * Obstacle rooms → ObstacleRoom (E3.6). Scenario rooms → ScenarioRoom (E3.7).
 * Both variants carry data-testid="screen-room" so the phase router assertion holds.
 */
function RoomRouter() {
  const currentRoom = useGameStore(s => s.session.present.currentRoom);
  if (currentRoom?.kind === 'obstacle') return <ObstacleRoom />;
  if (currentRoom?.kind === 'scenario') return <ScenarioRoom />;
  return <div data-testid="screen-room">Room (no current room)</div>;
}

// ── Phase router ──────────────────────────────────────────────────────────────

interface PhaseRouterProps {
  phase: RunPhase;
}

/**
 * Maps engine RunPhase to the correct GM console screen.
 * The router does NOT handle the pre-run Setup state — that is the app shell's
 * responsibility (app.tsx shows Setup before a run is started).
 *
 * When `pendingSpoils` is true and phase is 'offer', the Spoils interstitial
 * is shown instead of the Offer screen. The GM clicks Continue on Spoils to
 * clear the flag and advance to the Offer.
 */
export function PhaseRouter({ phase }: PhaseRouterProps) {
  const pendingSpoils = useGameStore(s => s.pendingSpoils);

  switch (phase) {
    case 'briefing': return <Briefing />;
    case 'room':     return <RoomRouter />;
    case 'minigame': return <MinigameHost />;
    case 'offer':    return pendingSpoils ? <Spoils /> : <Offer />;
    case 'getaway':  return <Getaway />;
    case 'result':   return <Result />;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export { Setup, Briefing, Offer, Getaway, Result };
