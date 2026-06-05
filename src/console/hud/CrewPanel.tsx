import { isResting } from '@/engine';
import type { Player, PlayerId, GearId } from '@/engine';

// ── Lane stat row ─────────────────────────────────────────────────────────────

const LANES = ['tech', 'physical', 'charm', 'stealth'] as const;

// ── Player card ───────────────────────────────────────────────────────────────

interface PlayerCardProps {
  player: Player;
  roomIndex: number;
  onAssignGear?: (gear: GearId, to: PlayerId) => void;
}

function PlayerCard({ player, roomIndex, onAssignGear }: PlayerCardProps) {
  const resting = isResting(player, roomIndex);

  return (
    <div
      data-testid={`crew-member-${player.id}`}
      aria-label={`${player.name}${resting ? ' (exhausted)' : ''}`}
      style={{ opacity: resting ? 0.5 : 1 }}
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
      <span data-testid={`crew-name-${player.id}`}>{player.name}</span>
      {resting && (
        <span data-testid={`crew-exhausted-${player.id}`}> [exhausted]</span>
      )}

      <div data-testid={`crew-stats-${player.id}`}>
        {LANES.map(lane => (
          <span key={lane} data-testid={`crew-stat-${player.id}-${lane}`}>
            {lane}: {player.stats[lane]}
          </span>
        ))}
      </div>

      <div data-testid={`crew-powerups-${player.id}`}>
        {LANES.filter(lane => player.powerUps[lane]).map(lane => (
          <span key={lane} data-testid={`crew-powerup-${player.id}-${lane}`}>
            [{lane} power-up]
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Crew panel ────────────────────────────────────────────────────────────────

interface CrewPanelProps {
  crew: Player[];
  roomIndex: number;
  /** When provided, player cards become drop targets for gear cards. */
  onAssignGear?: (gear: GearId, to: PlayerId) => void;
}

export function CrewPanel({ crew, roomIndex, onAssignGear }: CrewPanelProps) {
  return (
    <div data-testid="crew-panel">
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
