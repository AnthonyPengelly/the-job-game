// Crew-rail content for the cockpit left rail.
// Heat track, Loot, and phase info have moved to TopRail (src/console/shell/TopRail.tsx).
// This component is the left-rail placeholder until E13.2 introduces the proper CrewRail.
import { Tv, Users } from 'lucide-react';
import { useGameStore } from '@/console/store';
import type { GearId, PlayerId } from '@/engine';
import { CrewPanel } from './CrewPanel';
import { GearTray } from './GearTray';

// ── Hud ──────────────────────────────────────────────────────────────────────

export function Hud() {
  const crew      = useGameStore(s => s.session.present.crew);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const dispatch  = useGameStore(s => s.dispatch);

  function handleAssignGear(gear: GearId, to: PlayerId) {
    dispatch({ t: 'ASSIGN_GEAR', gear, to });
  }

  function handleOpenPlayerView() {
    window.open('player.html', 'the-job-player');
  }

  return (
    <div data-testid="crew-rail" style={{ display: 'contents' }}>
      {/* Crew rail header */}
      <div className="cockpit-crewrail-head">
        <span className="hl">
          <Users size={15} strokeWidth={1.75} aria-hidden="true" />
          Crew · {crew.length}
        </span>
      </div>

      {/* Crew list */}
      <div className="cockpit-crewrail-body">
        <CrewPanel crew={crew} roomIndex={roomIndex} onAssignGear={handleAssignGear} />
      </div>

      {/* Footer: player-view launcher + gear tray */}
      <div className="cockpit-crewrail-foot">
        <button
          className="btn btn-ghost"
          onClick={handleOpenPlayerView}
          data-testid="open-player-view"
          aria-label="Open player view"
          style={{ fontSize: '13px', padding: '8px 14px', gap: '7px', width: '100%' }}
        >
          <Tv size={16} strokeWidth={1.75} aria-hidden="true" />
          Player view
        </button>
        <GearTray />
      </div>
    </div>
  );
}
