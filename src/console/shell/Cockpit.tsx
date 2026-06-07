import { useGameStore } from '@/console/store';
import { TopRail } from './TopRail';
import { Stage } from './Stage';
import { CockpitActionBar } from './CockpitActionBar';
import './cockpit.css';

interface CockpitProps {
  /**
   * The phase screen content rendered inside the centre work stage.
   * Existing screens render unchanged here in E13.1; they will be
   * restyled into the cockpit language in E13.5–E13.9.
   */
  children: React.ReactNode;
  /**
   * Content for the left crew rail. Filled by Hud (crew panel placeholder)
   * in E13.1; replaced by the proper CrewRail in E13.2.
   */
  crewRail?: React.ReactNode;
  /**
   * Additional content mounted at the cockpit root (overlays, panels,
   * soundboard, etc. that are absolutely positioned over the grid).
   */
  overlays?: React.ReactNode;
}

/**
 * The fixed cockpit frame.
 *
 * A viewport-locked CSS grid — never scrolls the document. Five stable
 * regions: top rail (meters), left rail (crew — filled in E13.2), centre
 * stage (work area), right rail (tools — filled in E13.3), and action bar.
 * Overlays are rendered at the cockpit root so they position absolutely
 * over the grid.
 */
export function Cockpit({ children, crewRail, overlays }: CockpitProps) {
  const escapeSignal = useGameStore(s => s.session.present.escapeSignal);

  return (
    <div
      className={`cockpit${escapeSignal ? ' hot' : ''}`}
      data-testid="cockpit"
    >
      <TopRail />

      {/* Left rail — crew placeholder, filled by CrewRail in E13.2 */}
      <aside
        className="cockpit-crewrail"
        aria-label="Crew"
        data-testid="cockpit-crewrail"
      >
        {crewRail}
      </aside>

      <Stage>
        {children}
      </Stage>

      {/* Right rail — tools placeholder, filled by ToolRail in E13.3 */}
      <aside
        className="cockpit-toolsrail"
        aria-label="Tools"
        data-testid="cockpit-toolsrail"
      />

      <CockpitActionBar />

      {/* Absolutely-positioned overlays rendered at the cockpit root */}
      {overlays}
    </div>
  );
}
