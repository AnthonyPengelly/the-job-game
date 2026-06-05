// Always-available GM override surface. Mounted once in the layout (app.tsx)
// so it persists across all phase screens. Every control dispatches through the
// store, which passes the event through reduce — overrides are therefore pure,
// testable, and themselves undoable. Phase-jump + Undo Last guarantee no
// dead-ends: the GM can always edit out of any state the engine can reach.
import { useState } from 'react';
import { useGameStore } from '@/console/store';
import type { GameStoreState } from '@/console/store';
import type { Lane, RunPhase, Player } from '@/engine';

const LANES: readonly Lane[] = ['tech', 'physical', 'charm', 'stealth'];
const ALL_PHASES: readonly RunPhase[] = [
  'briefing',
  'room',
  'minigame',
  'offer',
  'getaway',
  'result',
];

// ── Per-player override controls ─────────────────────────────────────────────

interface PlayerOverridesProps {
  player: Player;
  dispatch: GameStoreState['dispatch'];
}

function PlayerOverrides({ player, dispatch }: PlayerOverridesProps) {
  const [restInput, setRestInput] = useState('');
  const [statInputs, setStatInputs] = useState<Record<Lane, string>>({
    tech: '',
    physical: '',
    charm: '',
    stealth: '',
  });

  function updateStatInput(lane: Lane, value: string): void {
    setStatInputs(prev => ({ ...prev, [lane]: value }));
  }

  return (
    <div data-testid={`override-player-${player.id}`}>
      <strong>{player.name}</strong>

      {/* Lane stats: adjust ±1 or set to an explicit value */}
      {LANES.map(lane => (
        <div key={lane} data-testid={`override-stat-row-${player.id}-${lane}`}>
          <span>
            {lane}: {player.stats[lane]}
          </span>
          <button
            data-testid={`btn-override-stat-minus-${player.id}-${lane}`}
            onClick={() =>
              dispatch({ t: 'OVERRIDE_ADJUST_STAT', player: player.id, lane, delta: -1 })
            }
          >
            -1
          </button>
          <button
            data-testid={`btn-override-stat-plus-${player.id}-${lane}`}
            onClick={() =>
              dispatch({ t: 'OVERRIDE_ADJUST_STAT', player: player.id, lane, delta: 1 })
            }
          >
            +1
          </button>
          <input
            data-testid={`override-stat-input-${player.id}-${lane}`}
            type="number"
            value={statInputs[lane]}
            onChange={e => updateStatInput(lane, e.target.value)}
            aria-label={`Set ${lane} stat for ${player.name}`}
          />
          <button
            data-testid={`btn-override-set-stat-${player.id}-${lane}`}
            onClick={() => {
              const v = parseInt(statInputs[lane], 10);
              if (!isNaN(v)) {
                dispatch({ t: 'OVERRIDE_SET_STAT', player: player.id, lane, value: v });
                setStatInputs(prev => ({ ...prev, [lane]: '' }));
              }
            }}
          >
            Set
          </button>
        </div>
      ))}

      {/* Power-ups: toggle held/cleared per lane */}
      {LANES.map(lane => (
        <button
          key={lane}
          data-testid={`btn-override-powerup-${player.id}-${lane}`}
          onClick={() =>
            dispatch({
              t: 'OVERRIDE_SET_POWERUP',
              player: player.id,
              lane,
              held: !player.powerUps[lane],
            })
          }
        >
          {player.powerUps[lane] ? `Clear ${lane} power-up` : `Set ${lane} power-up`}
        </button>
      ))}

      {/* Resting: set until a specific room or clear */}
      <div data-testid={`override-resting-row-${player.id}`}>
        <input
          data-testid={`override-resting-input-${player.id}`}
          type="number"
          value={restInput}
          onChange={e => setRestInput(e.target.value)}
          placeholder="Rest until room #"
          aria-label={`Set resting until room for ${player.name}`}
        />
        <button
          data-testid={`btn-override-set-resting-${player.id}`}
          onClick={() => {
            const v = parseInt(restInput, 10);
            if (!isNaN(v)) {
              dispatch({ t: 'OVERRIDE_SET_RESTING', player: player.id, untilRoom: v });
              setRestInput('');
            }
          }}
        >
          Set Resting
        </button>
        <button
          data-testid={`btn-override-clear-resting-${player.id}`}
          onClick={() => dispatch({ t: 'OVERRIDE_SET_RESTING', player: player.id })}
        >
          Clear Resting
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function OverridePanel() {
  const [open, setOpen] = useState(false);
  const [heatInput, setHeatInput] = useState('');
  const [lootInput, setLootInput] = useState('');

  const dispatch = useGameStore(s => s.dispatch);
  const undo = useGameStore(s => s.undo);
  const heat = useGameStore(s => s.session.present.heat);
  const loot = useGameStore(s => s.session.present.loot);
  const crew = useGameStore(s => s.session.present.crew);
  const hMax = useGameStore(s => s.cfg.heat.hMax);

  return (
    <div data-testid="override-panel">
      {/* Undo is always accessible — prominent, outside the toggle, no dead-ends */}
      <button data-testid="btn-undo-last" onClick={() => undo()}>
        Undo Last
      </button>
      <button
        data-testid="btn-override-toggle"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        GM Overrides {open ? '▲' : '▼'}
      </button>

      {open && (
        <div data-testid="override-panel-body">
          {/* ── Heat ── */}
          <section data-testid="override-section-heat">
            <strong>
              Heat ({heat}/{hMax})
            </strong>
            <button
              data-testid="btn-override-adjust-heat-minus"
              onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_HEAT', delta: -1 })}
            >
              Heat -1
            </button>
            <button
              data-testid="btn-override-adjust-heat-plus"
              onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_HEAT', delta: 1 })}
            >
              Heat +1
            </button>
            <input
              data-testid="override-heat-input"
              type="number"
              value={heatInput}
              onChange={e => setHeatInput(e.target.value)}
              aria-label="Set heat value"
            />
            <button
              data-testid="btn-override-set-heat"
              onClick={() => {
                const v = parseInt(heatInput, 10);
                if (!isNaN(v)) {
                  dispatch({ t: 'OVERRIDE_SET_HEAT', value: v });
                  setHeatInput('');
                }
              }}
            >
              Set Heat
            </button>
          </section>

          {/* ── Loot ── */}
          <section data-testid="override-section-loot">
            <strong>Loot ({loot})</strong>
            <button
              data-testid="btn-override-adjust-loot-minus"
              onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_LOOT', delta: -1 })}
            >
              Loot -1
            </button>
            <button
              data-testid="btn-override-adjust-loot-plus"
              onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_LOOT', delta: 1 })}
            >
              Loot +1
            </button>
            <input
              data-testid="override-loot-input"
              type="number"
              value={lootInput}
              onChange={e => setLootInput(e.target.value)}
              aria-label="Set loot value"
            />
            <button
              data-testid="btn-override-set-loot"
              onClick={() => {
                const v = parseInt(lootInput, 10);
                if (!isNaN(v)) {
                  dispatch({ t: 'OVERRIDE_SET_LOOT', value: v });
                  setLootInput('');
                }
              }}
            >
              Set Loot
            </button>
          </section>

          {/* ── Per-player ── */}
          {crew.map(player => (
            <PlayerOverrides key={player.id} player={player} dispatch={dispatch} />
          ))}

          {/* ── Room ── */}
          <section data-testid="override-section-room">
            <strong>Room</strong>
            <button
              data-testid="btn-override-reroll-room"
              onClick={() => dispatch({ t: 'OVERRIDE_REROLL_ROOM' })}
            >
              Re-roll Room
            </button>
            <button
              data-testid="btn-override-skip-room"
              onClick={() => dispatch({ t: 'OVERRIDE_SKIP_ROOM' })}
            >
              Skip Room
            </button>
          </section>

          {/* ── Phase jump ── */}
          <section data-testid="override-section-phase">
            <strong>Phase</strong>
            {/*
             * Controlled to value="" so the placeholder always shows after a
             * jump or Undo Last. Since value never moves away from "", any
             * option (including the current phase) triggers onChange — no
             * silent no-ops on re-selection.
             */}
            <select
              data-testid="override-phase-select"
              value=""
              onChange={e => {
                const v = e.target.value as RunPhase | '';
                if (v !== '') {
                  dispatch({ t: 'OVERRIDE_SET_PHASE', phase: v });
                }
              }}
            >
              <option value="">Jump to phase…</option>
              {ALL_PHASES.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </section>
        </div>
      )}
    </div>
  );
}
