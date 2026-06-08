import { Banknote, Repeat, Siren } from 'lucide-react';
import { useGameStore } from '@/console/store';
import type { RunPhase } from '@/engine';
import { HeatTrack } from '@/console/hud/HeatTrack';
import { formatLoot } from '@/content/format';

const PHASE_LABELS: Record<RunPhase, string> = {
  briefing: 'Briefing',
  room: 'Room',
  minigame: 'Mini-game',
  offer: 'Offer',
  getaway: 'Getaway',
  result: 'Result',
};

const PHASE_NUMS: Record<RunPhase, string> = {
  briefing: '02',
  room: '03',
  minigame: '04',
  offer: '05',
  getaway: '08',
  result: '09',
};

/** The fixed top rail: logo · phase/room · Heat track · escape signal · loot chip. */
export function TopRail() {
  const heat         = useGameStore(s => s.session.present.heat);
  const loot         = useGameStore(s => s.session.present.loot);
  const phase        = useGameStore(s => s.session.present.phase);
  const roomIndex    = useGameStore(s => s.session.present.roomIndex);
  const escapeSignal = useGameStore(s => s.session.present.escapeSignal);
  const crewName     = useGameStore(s => s.session.present.crewName);
  const hMax         = useGameStore(s => s.cfg.heat.hMax);

  const phaseLabel = PHASE_LABELS[phase];
  const phaseNum   = PHASE_NUMS[phase];

  return (
    <header className="cockpit-toprail" data-testid="hud">
      {/* Logo lockup */}
      <div className="cockpit-lockup">
        <span className="sq" aria-hidden="true" />
        <div>
          <div className="wm"><em>THE</em>_JOB</div>
          <div className="sub">GM Console</div>
        </div>
      </div>

      {/* Crew name — shown when present */}
      {crewName && (
        <div className="cockpit-crew-name" data-testid="top-rail-crew-name">
          <span className="k">Crew</span>
          <span className="v">{crewName}</span>
        </div>
      )}

      <div className="cockpit-rail-div" aria-hidden="true" />

      {/* Phase + room info */}
      <div className="cockpit-phaseblock">
        <span className="k">
          PHASE <b>{phaseNum}</b>
          {phase === 'room' || phase === 'minigame' ? ` · Room ${roomIndex + 1}` : ''}
        </span>
        <div className="ph">{phaseLabel}</div>
      </div>

      {/* Heat track */}
      <div className="cockpit-heat-section" data-testid="hud-heat-section">
        <div className="cockpit-heat-head">
          <span className="cockpit-hlabel">
            <span className="dot" aria-hidden="true" />
            Heat
          </span>
          <span className="cockpit-heat-count">
            <span className="lit">{String(heat).padStart(2, '0')}</span>
            <span className="tot"> / {hMax}</span>
          </span>
        </div>
        <HeatTrack heat={heat} hMax={hMax} />
      </div>

      {/* Escape signal */}
      {escapeSignal && (
        <div className="cockpit-escape-sig" role="status" aria-label="Escape signal active">
          <Siren size={18} strokeWidth={1.75} aria-hidden="true" />
          <span className="t">
            <span className="k">Getting hot</span>
            <span className="v">we can roll</span>
          </span>
        </div>
      )}

      {/* Room chip */}
      {(phase === 'room' || phase === 'minigame') && (
        <div className="cockpit-room-chip">
          <Repeat size={19} strokeWidth={1.75} aria-hidden="true" />
          <div className="stk">
            <span className="k">Room</span>
            <span className="v">{roomIndex + 1}</span>
          </div>
        </div>
      )}

      {/* Loot chip */}
      <div className="cockpit-loot-chip" data-testid="hud-loot-section">
        <Banknote size={19} strokeWidth={1.75} aria-hidden="true" />
        <div className="stk">
          <span className="k">Loot</span>
          <span className="v">{formatLoot(loot)}</span>
          <span data-testid="loot-total" className="sr-only">{loot}</span>
        </div>
      </div>
    </header>
  );
}
