import type { RunPhase } from '@/engine';
import { useGameStore } from '@/console/store';
import { Setup } from './Setup';
import { Briefing } from './Briefing';
import { ObstacleRoom } from './ObstacleRoom';
import { MinigameStub } from './MinigameStub';

// ── Room router ───────────────────────────────────────────────────────────────

/**
 * Reads currentRoom from the store and renders the appropriate room screen.
 * Obstacle rooms → ObstacleRoom (E3.6). Scenario rooms → placeholder (E3.7).
 * Both variants carry data-testid="screen-room" so the phase router assertion holds.
 */
function RoomRouter() {
  const currentRoom = useGameStore(s => s.session.present.currentRoom);
  if (currentRoom?.kind === 'obstacle') return <ObstacleRoom />;
  // Scenario rooms are implemented in E3.7.
  return <div data-testid="screen-room">Scenario Room (coming in E3.7)</div>;
}

// ── Placeholder screens (filled by E3.8) ─────────────────────────────────────

function OfferPlaceholder() {
  return <div data-testid="screen-offer">Offer (coming in E3.8)</div>;
}

function GetawayPlaceholder() {
  return <div data-testid="screen-getaway">Getaway (coming in E3.8)</div>;
}

function ResultPlaceholder() {
  return <div data-testid="screen-result">Result (coming in E3.8)</div>;
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
    case 'minigame': return <MinigameStub />;
    case 'offer':    return <OfferPlaceholder />;
    case 'getaway':  return <GetawayPlaceholder />;
    case 'result':   return <ResultPlaceholder />;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export { Setup, Briefing };
