import type { RunPhase } from '@/engine';
import { useGameStore } from '@/console/store';
import { Setup } from './Setup';
import { Briefing } from './Briefing';
import { ObstacleRoom } from './ObstacleRoom';
import { MinigameHost } from './MinigameHost';
import { ScenarioRoom } from './ScenarioRoom';
import { Offer } from './Offer';
import { GetawayStub } from './GetawayStub';
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
 */
export function PhaseRouter({ phase }: PhaseRouterProps) {
  switch (phase) {
    case 'briefing': return <Briefing />;
    case 'room':     return <RoomRouter />;
    case 'minigame': return <MinigameHost />;
    case 'offer':    return <Offer />;
    case 'getaway':  return <GetawayStub />;
    case 'result':   return <Result />;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export { Setup, Briefing, Offer, GetawayStub, Result };
