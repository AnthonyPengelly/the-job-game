import { isResting } from '@/engine';
import type { Player, PlayerId, GearId } from '@/engine';
import type { CrewRailMode } from './crewRailMode';

const LANES = ['tech', 'physical', 'charm', 'stealth'] as const;
const LANE_ABBR: Record<string, string> = {
  tech: 'TEC',
  physical: 'PHY',
  charm: 'CHA',
  stealth: 'STE',
};

interface CrewAvatarProps {
  player: Player;
  roomIndex: number;
  /** Current rail mode from context. Drives the state label. */
  railMode: CrewRailMode;
  /**
   * Selection state for this member:
   *   'commit-on' — committed to go / selected attempter (cyan glow)
   *   'pick'      — pickable, not yet committed (dashed edge)
   *   'idle'      — no active selection
   */
  picked: 'commit-on' | 'pick' | 'idle';
  /** Called when the avatar is clicked. */
  onClick: (id: PlayerId) => void;
  /** Gear drop target (used during Spoils and gear assignment flows). */
  onGearDrop?: (gear: GearId, to: PlayerId, earnedGearIndex?: number) => void;
}

function getStateLabel(railMode: CrewRailMode, picked: 'commit-on' | 'pick' | 'idle', resting: boolean): string {
  if (resting) return 'RESTS';
  if (railMode === 'commit') return picked === 'commit-on' ? 'GOING' : 'PICK';
  if (railMode === 'attempter') return picked === 'commit-on' ? 'ATTEMPTS' : 'PICK';
  return 'READY';
}

export function CrewAvatar({
  player,
  roomIndex,
  railMode,
  picked,
  onClick,
  onGearDrop,
}: CrewAvatarProps) {
  const resting = isResting(player, roomIndex);

  const memberCls = ['member'];
  if (resting) {
    memberCls.push('rest');
  } else {
    memberCls.push('idle');
    if (picked === 'commit-on') memberCls.push('commit-on');
    else if (picked === 'pick') memberCls.push('pick');
  }

  const stateLabel = getStateLabel(railMode, picked, resting);

  function handleDragOver(e: React.DragEvent) {
    if (!onGearDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: React.DragEvent) {
    if (!onGearDrop) return;
    e.preventDefault();
    const gearId = e.dataTransfer.getData('application/x-gear-id') as GearId;
    if (!gearId) return;
    const idxRaw = e.dataTransfer.getData('application/x-gear-index');
    const earnedGearIndex = idxRaw !== '' ? parseInt(idxRaw, 10) : undefined;
    onGearDrop(gearId, player.id, earnedGearIndex);
  }

  return (
    <div
      className={memberCls.join(' ')}
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
      {/* Top row: avatar initial + name + state badge */}
      <div className="m-top">
        <span className="av" aria-hidden="true">
          {player.name[0]}
        </span>
        <span className="who">
          <span className="nm" data-testid={`crew-name-${player.id}`}>
            {player.name}
          </span>
        </span>
        <span
          className="mstate"
          data-testid={`crew-state-${player.id}`}
          aria-label={stateLabel}
        >
          {resting ? (
            <span data-testid={`crew-exhausted-${player.id}`}>{stateLabel}</span>
          ) : (
            stateLabel
          )}
        </span>
      </div>

      {/* Four-cell lane stat strip */}
      <div className="lanes" data-testid={`crew-stats-${player.id}`}>
        {LANES.map(lane => {
          const hot = Boolean(player.powerUps[lane]);
          return (
            <div key={lane} className={`lane${hot ? ' hot' : ''}`}>
              <span className="ll" aria-hidden="true">{LANE_ABBR[lane]}</span>
              <span
                className="lv"
                data-testid={`crew-stat-${player.id}-${lane}`}
                aria-label={`${lane}: ${player.stats[lane]}`}
              >
                {player.stats[lane]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Power-up pips row — one pip per lane, lit when power-up is active */}
      <div
        className="pips"
        data-testid={`crew-powerups-${player.id}`}
        aria-label={`Power-ups: ${LANES.filter(l => player.powerUps[l]).join(', ') || 'none'}`}
      >
        {LANES.map(lane => (
          <span
            key={lane}
            className={`pip${player.powerUps[lane] ? ' on' : ''}`}
            data-testid={player.powerUps[lane] ? `crew-powerup-${player.id}-${lane}` : undefined}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
