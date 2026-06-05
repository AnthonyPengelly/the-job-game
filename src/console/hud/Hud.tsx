// Always-visible GM HUD: Heat track, Loot total, crew panel.
// Mounted once in the layout; persists across all phase screens.
// Read-only — all mutation flows through screens and the override surface.
import { useGameStore } from '@/console/store';
import { HeatTrack } from './HeatTrack';
import { CrewPanel } from './CrewPanel';

export function Hud() {
  const heat = useGameStore(s => s.session.present.heat);
  const loot = useGameStore(s => s.session.present.loot);
  const crew = useGameStore(s => s.session.present.crew);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const hMax = useGameStore(s => s.cfg.heat.hMax);

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
      <CrewPanel crew={crew} roomIndex={roomIndex} />
    </div>
  );
}
