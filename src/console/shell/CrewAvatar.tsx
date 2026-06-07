import { isResting } from '@/engine';
import type { Player, PlayerId, GearId } from '@/engine';

const LANES = ['tech', 'physical', 'charm', 'stealth'] as const;
const LANE_ABBR: Record<string, string> = {
  tech: 'T',
  physical: 'P',
  charm: 'C',
  stealth: 'S',
};

interface CrewAvatarProps {
  player: Player;
  roomIndex: number;
  /** Visual selection state driven by the stage's crew-rail mode. */
  selectionState: 'none' | 'commit' | 'attempter';
  /** Called when the avatar is clicked. */
  onClick: (id: PlayerId) => void;
  /** Gear drop target (used during Spoils and gear assignment flows). */
  onGearDrop?: (gear: GearId, to: PlayerId) => void;
}

/**
 * A single crew member's avatar card in the left crew rail.
 *
 * Bigger and more legible than the old 38px CrewPanel dot. Shows: avatar
 * initial, player name, four lane stats (compact), active power-up pips, and
 * exhaustion/in-play state. Highlights with colour when in commit or attempter
 * selection mode.
 */
export function CrewAvatar({
  player,
  roomIndex,
  selectionState,
  onClick,
  onGearDrop,
}: CrewAvatarProps) {
  const resting = isResting(player, roomIndex);
  const activePips = LANES.filter(lane => player.powerUps[lane]);

  function handleDragOver(e: React.DragEvent) {
    if (!onGearDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: React.DragEvent) {
    if (!onGearDrop) return;
    e.preventDefault();
    const gearId = e.dataTransfer.getData('application/x-gear-id') as GearId;
    if (gearId) onGearDrop(gearId, player.id);
  }

  const selClass =
    selectionState === 'commit'
      ? ' selected-commit'
      : selectionState === 'attempter'
        ? ' selected-attempter'
        : '';

  return (
    <div
      className={`crew-av${resting ? ' resting' : ''}${selClass}`}
      data-testid={`crew-member-${player.id}`}
      data-out={resting ? 'true' : 'false'}
      aria-label={`${player.name}${resting ? ' (exhausted)' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onClick(player.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(player.id); }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Avatar initial + name */}
      <div className="crew-av-row">
        <span className="crew-av-initial" aria-hidden="true">
          {player.name[0]}
        </span>
        <div className="crew-av-name-block">
          <span className="crew-av-name" data-testid={`crew-name-${player.id}`}>
            {player.name}
          </span>
          <span className="crew-av-status">
            {resting ? (
              <span data-testid={`crew-exhausted-${player.id}`}>Out</span>
            ) : (
              'In play'
            )}
          </span>
        </div>
      </div>

      {/* Lane stats compact grid */}
      <div className="crew-av-stats" data-testid={`crew-stats-${player.id}`}>
        {LANES.map(lane => (
          <div key={lane} className="crew-av-stat">
            <span className="k" aria-hidden="true">{LANE_ABBR[lane]}</span>
            <span
              className="v"
              data-testid={`crew-stat-${player.id}-${lane}`}
              aria-label={`${lane}: ${player.stats[lane]}`}
            >
              {player.stats[lane]}
            </span>
          </div>
        ))}
      </div>

      {/* Power-up pips + sr-only listing */}
      <div className="crew-av-pips" data-testid={`crew-powerups-${player.id}`} aria-label={`Power-ups: ${activePips.join(', ') || 'none'}`}>
        {activePips.map(lane => (
          <span
            key={lane}
            className="crew-av-pip"
            data-testid={`crew-powerup-${player.id}-${lane}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
