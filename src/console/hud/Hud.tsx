// Always-visible GM HUD: logo, Heat track, counter chips, crew panel, gear tray, phase rail.
// Mounted once in the layout; persists across all phase screens.
// Read-only for heat/loot (only engine events mutate state); gear assignment dispatches ASSIGN_GEAR.
import { Banknote, Repeat, Tv, Users } from 'lucide-react';
import { useGameStore } from '@/console/store';
import type { GearId, PlayerId, RunPhase } from '@/engine';
import { HeatTrack } from './HeatTrack';
import { CrewPanel } from './CrewPanel';
import { GearTray } from './GearTray';

// ── Phase rail config ─────────────────────────────────────────────────────────

const RAIL_PHASES: Array<{ key: RunPhase; label: string }> = [
  { key: 'briefing', label: 'Brief' },
  { key: 'room',     label: 'Rooms' },
  { key: 'offer',    label: 'Offer' },
  { key: 'getaway',  label: 'Getaway' },
  { key: 'result',   label: 'Result' },
];

function phaseToRailIndex(phase: RunPhase): number {
  switch (phase) {
    case 'briefing': return 0;
    case 'room':
    case 'minigame': return 1;
    case 'offer':    return 2;
    case 'getaway':  return 3;
    case 'result':   return 4;
  }
}

// ── Hud ──────────────────────────────────────────────────────────────────────

export function Hud() {
  const heat      = useGameStore(s => s.session.present.heat);
  const loot      = useGameStore(s => s.session.present.loot);
  const crew      = useGameStore(s => s.session.present.crew);
  const phase     = useGameStore(s => s.session.present.phase);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const hMax      = useGameStore(s => s.cfg.heat.hMax);
  const dispatch  = useGameStore(s => s.dispatch);

  const activeRailIdx  = phaseToRailIndex(phase);

  function handleAssignGear(gear: GearId, to: PlayerId) {
    dispatch({ t: 'ASSIGN_GEAR', gear, to });
  }

  function handleRailClick(railPhase: RunPhase) {
    dispatch({ t: 'OVERRIDE_SET_PHASE', phase: railPhase });
  }

  function handleOpenPlayerView() {
    window.open('player.html', 'the-job-player');
  }

  return (
    <header className="hud" data-testid="hud">
      <div className="hud-main">
        {/* Logo lockup */}
        <div className="lockup">
          <span className="sq" aria-hidden="true" />
          <div>
            <div className="wm"><em>THE</em>_JOB</div>
            <div className="sub">GM Console</div>
          </div>
        </div>

        {/* Heat block */}
        <div className="hud-block grow" data-testid="hud-heat-section">
          <div className="heatwrap">
            <div className="heat-head">
              <span className="hlabel">
                <span className="dot heat" aria-hidden="true" />
                Heat
              </span>
              <span className="heat-count">
                <span className="lit">{String(heat).padStart(2, '0')}</span>
                <span className="tot"> / {hMax}</span>
              </span>
            </div>
            <HeatTrack heat={heat} hMax={hMax} />
          </div>
        </div>

        {/* Counter chips */}
        <div className="chips">
          {/* Loot chip — testid="hud-loot-section" preserves the section anchor; loot-total has raw value */}
          <div className="chip accent" data-testid="hud-loot-section">
            <Banknote size={18} strokeWidth={1.75} aria-hidden="true" />
            <div className="stk">
              <span className="k">Loot</span>
              <span className="v">{loot}</span>
              <span data-testid="loot-total" className="sr-only">{loot}</span>
            </div>
          </div>

          {/* Room counter chip */}
          <div className="chip">
            <Repeat size={18} strokeWidth={1.75} aria-hidden="true" />
            <div className="stk">
              <span className="k">Room</span>
              <span className="v">{roomIndex + 1}</span>
            </div>
          </div>
        </div>

        {/* Crew avatars */}
        <div className="hud-block">
          <span className="hlabel">
            <Users size={14} strokeWidth={1.75} aria-hidden="true" />
            Crew
          </span>
          <CrewPanel crew={crew} roomIndex={roomIndex} onAssignGear={handleAssignGear} />
        </div>

        {/* Player-view launcher */}
        <button
          className="btn btn-ghost"
          onClick={handleOpenPlayerView}
          data-testid="open-player-view"
          aria-label="Open player view"
          style={{ fontSize: '13px', padding: '8px 14px', gap: '7px' }}
        >
          <Tv size={16} strokeWidth={1.75} aria-hidden="true" />
          Player view
        </button>
      </div>

      {/* Phase rail */}
      <nav className="rail" aria-label="Phase navigation">
        {RAIL_PHASES.map((p, i) => (
          <button
            key={p.key}
            className={`pill${i === activeRailIdx ? ' now' : i < activeRailIdx ? ' done' : ''}`}
            onClick={() => handleRailClick(p.key)}
            aria-current={i === activeRailIdx ? 'step' : undefined}
          >
            <span className="n">{String(i + 1).padStart(2, '0')}</span>
            {p.label}
          </button>
        ))}
      </nav>

      {/* Gear tray */}
      <GearTray />
    </header>
  );
}
