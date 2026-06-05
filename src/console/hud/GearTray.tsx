import { useState } from 'react';
import { useGameStore } from '@/console/store';
import type { GearId, PlayerId, Player } from '@/engine';
import type { GearDef } from '@/engine/config';

// ── GearCard ──────────────────────────────────────────────────────────────────

interface GearCardProps {
  gearId: GearId;
  def: GearDef;
  crew: Player[];
  onAssign: (to: PlayerId) => void;
}

function GearCard({ gearId, def, crew, onAssign }: GearCardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState('');

  const label =
    def.kind === 'statBoost'
      ? `${def.lane} +${def.magnitude}`
      : `${def.lane} power-up`;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-gear-id', gearId);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      data-testid={`gear-card-${gearId}`}
      aria-label={label}
    >
      <span data-testid={`gear-label-${gearId}`}>{label}</span>
      {/* Click-to-assign fallback: accessible and pointer-free */}
      <select
        value={selectedPlayer}
        onChange={(e) => setSelectedPlayer(e.target.value)}
        data-testid={`gear-select-${gearId}`}
        aria-label={`Assign ${label} to crew member`}
      >
        <option value="">Select player…</option>
        {crew.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (selectedPlayer !== '') {
            // selectedPlayer can only be set to a value from crew[].id — safe brand-cast
            onAssign(selectedPlayer as PlayerId);
          }
        }}
        disabled={selectedPlayer === ''}
        data-testid={`gear-assign-${gearId}`}
      >
        Assign
      </button>
    </div>
  );
}

// ── GearTray ──────────────────────────────────────────────────────────────────

export function GearTray() {
  // Keys in cfg.gear are gear IDs from the preset catalog — safe brand-cast to GearId
  const gearRecord = useGameStore((s) => s.cfg.gear);
  const crew = useGameStore((s) => s.session.present.crew);
  const dispatch = useGameStore((s) => s.dispatch);

  return (
    <div data-testid="gear-tray">
      {Object.entries(gearRecord).map(([id, def]) => (
        <GearCard
          key={id}
          gearId={id as GearId}
          def={def}
          crew={crew}
          onAssign={(to) => dispatch({ t: 'ASSIGN_GEAR', gear: id as GearId, to })}
        />
      ))}
    </div>
  );
}
