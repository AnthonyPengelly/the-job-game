// Always-visible GM HUD: Heat track, Loot total, crew panel, gear tray.
// Mounted once in the layout; persists across all phase screens.
// Read-only display for heat/loot/crew; gear assignment dispatches ASSIGN_GEAR.
import { useGameStore } from '@/console/store';
import type { GearId, PlayerId } from '@/engine';
import { HeatTrack } from './HeatTrack';
import { CrewPanel } from './CrewPanel';
import { GearTray } from './GearTray';

export function Hud() {
  const heat = useGameStore(s => s.session.present.heat);
  const loot = useGameStore(s => s.session.present.loot);
  const crew = useGameStore(s => s.session.present.crew);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const hMax = useGameStore(s => s.cfg.heat.hMax);
  const dispatch = useGameStore(s => s.dispatch);

  function handleAssignGear(gear: GearId, to: PlayerId) {
    dispatch({ t: 'ASSIGN_GEAR', gear, to });
  }

  return (
    <div data-testid="hud">
      <div data-testid="hud-heat-section">
        <span>Heat</span>
        <HeatTrack heat={heat} hMax={hMax} />
      </div>
      <div data-testid="hud-loot-section">
        <span>Loot: </span>
        <span data-testid="loot-total">{loot}</span>
      </div>
      <CrewPanel crew={crew} roomIndex={roomIndex} onAssignGear={handleAssignGear} />
      <GearTray />
    </div>
  );
}
