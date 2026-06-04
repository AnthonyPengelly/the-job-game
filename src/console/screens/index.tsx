import type { RunPhase } from '@/engine';
import { Setup } from './Setup';
import { Briefing } from './Briefing';

// ── Placeholder screens (filled by E3.5–E3.8) ────────────────────────────────

function RoomPlaceholder() {
  return <div data-testid="screen-room">Room (coming in E3.6)</div>;
}

function MinigamePlaceholder() {
  return <div data-testid="screen-minigame">Mini-game (coming in E3.6)</div>;
}

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
    case 'room':     return <RoomPlaceholder />;
    case 'minigame': return <MinigamePlaceholder />;
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
