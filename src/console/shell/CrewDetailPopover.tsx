import { useState } from 'react';
import { X } from 'lucide-react';
import { isResting } from '@/engine';
import type { Player, Lane } from '@/engine';
import type { GameStoreState } from '@/console/store';
import { Popover } from './overlays/Popover';

const LANES: readonly Lane[] = ['tech', 'physical', 'charm', 'stealth'];

interface CrewDetailPopoverProps {
  player: Player;
  roomIndex: number;
  dispatch: GameStoreState['dispatch'];
  /**
   * Position relative to the cockpit container.
   * Passed straight through to the Popover primitive.
   */
  style?: React.CSSProperties;
  onClose: () => void;
}

/**
 * Per-player override surface, rendered as a Popover anchored to the avatar.
 *
 * Exposes every editing capability the old OverridePanel offered per-player:
 *   - Stats: ±1 adjust / explicit set
 *   - Power-ups: toggle each lane on/off
 *   - Rest: set until a room number / clear immediately
 *   - Gear: read-only display of active power-up lanes (gear effects land here)
 *
 * Dispatches only existing OVERRIDE_* events — no engine change.
 */
export function CrewDetailPopover({
  player,
  roomIndex,
  dispatch,
  style,
  onClose,
}: CrewDetailPopoverProps) {
  const [statInputs, setStatInputs] = useState<Record<Lane, string>>({
    tech: '',
    physical: '',
    charm: '',
    stealth: '',
  });
  const [restInput, setRestInput] = useState('');

  const resting = isResting(player, roomIndex);
  const activePowerUpLanes = LANES.filter(lane => player.powerUps[lane]);

  function setStatInput(lane: Lane, val: string) {
    setStatInputs(prev => ({ ...prev, [lane]: val }));
  }

  function commitSetStat(lane: Lane) {
    const v = parseInt(statInputs[lane], 10);
    if (!isNaN(v)) {
      dispatch({ t: 'OVERRIDE_SET_STAT', player: player.id, lane, value: v });
      setStatInput(lane, '');
    }
  }

  return (
    <Popover
      {...(style !== undefined ? { style } : {})}
      anchor="left"
      onClose={onClose}
      data-testid={`crew-detail-popover-${player.id}`}
    >
      {/* Header */}
      <div className="crew-detail-popover-head">
        <span className="crew-detail-popover-name">{player.name}</span>
        <button
          className="crew-detail-popover-close"
          aria-label={`Close ${player.name} detail`}
          onClick={onClose}
          data-testid={`crew-detail-close-${player.id}`}
        >
          <X size={16} />
        </button>
      </div>

      <div className="cockpit-popover-body" style={{ maxHeight: 460, overflowY: 'auto' }}>

        {/* ── Stats ── */}
        <div className="crew-detail-section" data-testid={`override-player-${player.id}`}>
          <span className="crew-detail-section-label">Stats</span>
          {LANES.map(lane => (
            <div key={lane} className="crew-detail-stat-row" data-testid={`override-stat-row-${player.id}-${lane}`}>
              <span className="crew-detail-stat-lane">
                {lane} <span className="crew-detail-stat-val">{player.stats[lane]}</span>
              </span>
              <button
                className="crew-detail-btn"
                data-testid={`btn-override-stat-minus-${player.id}-${lane}`}
                aria-label={`${lane} -1 for ${player.name}`}
                onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_STAT', player: player.id, lane, delta: -1 })}
              >
                −1
              </button>
              <button
                className="crew-detail-btn"
                data-testid={`btn-override-stat-plus-${player.id}-${lane}`}
                aria-label={`${lane} +1 for ${player.name}`}
                onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_STAT', player: player.id, lane, delta: 1 })}
              >
                +1
              </button>
              <input
                className="crew-detail-stat-input"
                type="number"
                data-testid={`override-stat-input-${player.id}-${lane}`}
                value={statInputs[lane]}
                onChange={e => setStatInput(lane, e.target.value)}
                aria-label={`Set ${lane} for ${player.name}`}
                placeholder="—"
              />
              <button
                className="crew-detail-btn"
                data-testid={`btn-override-set-stat-${player.id}-${lane}`}
                aria-label={`Set ${lane} stat for ${player.name}`}
                onClick={() => commitSetStat(lane)}
              >
                Set
              </button>
            </div>
          ))}
        </div>

        {/* ── Power-ups ── */}
        <div className="crew-detail-section">
          <span className="crew-detail-section-label">Power-ups</span>
          <div className="crew-detail-powerup-grid">
            {LANES.map(lane => {
              const held = Boolean(player.powerUps[lane]);
              return (
                <button
                  key={lane}
                  className={`crew-detail-powerup-btn${held ? ' active' : ''}`}
                  data-testid={`btn-override-powerup-${player.id}-${lane}`}
                  aria-pressed={held}
                  onClick={() =>
                    dispatch({ t: 'OVERRIDE_SET_POWERUP', player: player.id, lane, held: !held })
                  }
                >
                  {lane}
                  {held ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Resting ── */}
        <div className="crew-detail-section">
          <span className="crew-detail-section-label">Rest</span>
          <div className="crew-detail-rest-row" data-testid={`override-resting-row-${player.id}`}>
            <input
              className="crew-detail-stat-input"
              type="number"
              data-testid={`override-resting-input-${player.id}`}
              value={restInput}
              onChange={e => setRestInput(e.target.value)}
              placeholder="Room #"
              aria-label={`Set resting until room for ${player.name}`}
              style={{ width: 70 }}
            />
            <button
              className="crew-detail-btn"
              data-testid={`btn-override-set-resting-${player.id}`}
              onClick={() => {
                const v = parseInt(restInput, 10);
                if (!isNaN(v)) {
                  dispatch({ t: 'OVERRIDE_SET_RESTING', player: player.id, untilRoom: v });
                  setRestInput('');
                }
              }}
            >
              Set rest
            </button>
            {resting && (
              <button
                className="crew-detail-btn danger"
                data-testid={`btn-override-clear-resting-${player.id}`}
                onClick={() => dispatch({ t: 'OVERRIDE_SET_RESTING', player: player.id })}
              >
                Clear rest
              </button>
            )}
          </div>
        </div>

        {/* ── Gear (read-only) ── */}
        <div className="crew-detail-section">
          <span className="crew-detail-section-label">Gear held</span>
          <div className="crew-detail-gear-list">
            {activePowerUpLanes.length > 0 ? (
              activePowerUpLanes.map(lane => (
                <span key={lane} className="crew-detail-gear-item">
                  ⬡ {lane.toUpperCase()} POWER-UP
                </span>
              ))
            ) : (
              <span className="crew-detail-gear-empty">No gear assigned</span>
            )}
          </div>
        </div>

      </div>
    </Popover>
  );
}
