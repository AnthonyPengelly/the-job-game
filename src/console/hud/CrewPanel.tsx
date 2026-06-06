import { isResting } from '@/engine';
import type { Player, PlayerId, GearId } from '@/engine';

const LANES = ['tech', 'physical', 'charm', 'stealth'] as const;

interface PlayerCardProps {
  player: Player;
  roomIndex: number;
  onAssignGear?: (gear: GearId, to: PlayerId) => void;
}

function PlayerCard({ player, roomIndex, onAssignGear }: PlayerCardProps) {
  const resting = isResting(player, roomIndex);
  const hasGear = Object.values(player.powerUps).some(Boolean);

  return (
    <div
      className="av"
      data-testid={`crew-member-${player.id}`}
      data-out={resting ? 'true' : 'false'}
      aria-label={`${player.name}${resting ? ' (exhausted)' : ''}`}
      title={player.name}
      onDragOver={
        onAssignGear
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          : undefined
      }
      onDrop={
        onAssignGear
          ? (e) => {
              e.preventDefault();
              const gearId = e.dataTransfer.getData('application/x-gear-id') as GearId;
              if (gearId) onAssignGear(gearId, player.id);
            }
          : undefined
      }
    >
      {/* Visible avatar initial */}
      <span aria-hidden="true">{player.name[0]}</span>

      {/* Gear indicator dot */}
      {hasGear && !resting && <span className="gdot" aria-hidden="true" />}

      {/* Exhausted marker (visible to tests and screen readers) */}
      {resting && (
        <span data-testid={`crew-exhausted-${player.id}`} className="sr-only"> [exhausted]</span>
      )}

      {/* Name (sr-only for tests) */}
      <span data-testid={`crew-name-${player.id}`} className="sr-only">{player.name}</span>

      {/* Stats (kept for tests and screen readers) */}
      <div data-testid={`crew-stats-${player.id}`} className="sr-only">
        {LANES.map(lane => (
          <span key={lane} data-testid={`crew-stat-${player.id}-${lane}`}>
            {lane}: {player.stats[lane]}
          </span>
        ))}
      </div>

      {/* Power-ups (kept for tests and screen readers) */}
      <div data-testid={`crew-powerups-${player.id}`} className="sr-only">
        {LANES.filter(lane => player.powerUps[lane]).map(lane => (
          <span key={lane} data-testid={`crew-powerup-${player.id}-${lane}`}>
            [{lane} power-up]
          </span>
        ))}
      </div>
    </div>
  );
}

interface CrewPanelProps {
  crew: Player[];
  roomIndex: number;
  onAssignGear?: (gear: GearId, to: PlayerId) => void;
}

export function CrewPanel({ crew, roomIndex, onAssignGear }: CrewPanelProps) {
  return (
    <div data-testid="crew-panel" className="crew-row">
      {crew.map(player => (
        <PlayerCard
          key={player.id}
          player={player}
          roomIndex={roomIndex}
          {...(onAssignGear !== undefined ? { onAssignGear } : {})}
        />
      ))}
    </div>
  );
}
