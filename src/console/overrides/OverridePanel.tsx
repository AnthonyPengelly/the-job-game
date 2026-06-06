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
    <div data-testid={`override-player-${player.id}`} className="panel" style={{ marginTop: 8 }}>
      <div className="panel-head">
        <h3 style={{ fontSize: 15 }}>{player.name}</h3>
      </div>
      <div className="panel-body">
        {/* Lane stats: adjust ±1 or set to an explicit value */}
        {LANES.map(lane => (
          <div key={lane} data-testid={`override-stat-row-${player.id}-${lane}`}
               style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span className="t-label" style={{ minWidth: 80 }}>
              {lane}: {player.stats[lane]}
            </span>
            <button
              data-testid={`btn-override-stat-minus-${player.id}-${lane}`}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: 14 }}
              onClick={() =>
                dispatch({ t: 'OVERRIDE_ADJUST_STAT', player: player.id, lane, delta: -1 })
              }
            >
              -1
            </button>
            <button
              data-testid={`btn-override-stat-plus-${player.id}-${lane}`}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: 14 }}
              onClick={() =>
                dispatch({ t: 'OVERRIDE_ADJUST_STAT', player: player.id, lane, delta: 1 })
              }
            >
              +1
            </button>
            <input
              data-testid={`override-stat-input-${player.id}-${lane}`}
              type="number"
              className="inp"
              style={{ width: 60, padding: '4px 8px', fontSize: 14 }}
              value={statInputs[lane]}
              onChange={e => updateStatInput(lane, e.target.value)}
              aria-label={`Set ${lane} stat for ${player.name}`}
            />
            <button
              data-testid={`btn-override-set-stat-${player.id}-${lane}`}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: 14 }}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {LANES.map(lane => (
            <button
              key={lane}
              data-testid={`btn-override-powerup-${player.id}-${lane}`}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: 13 }}
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
        </div>

        {/* Resting: set until a specific room or clear */}
        <div data-testid={`override-resting-row-${player.id}`}
             style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <input
            data-testid={`override-resting-input-${player.id}`}
            type="number"
            className="inp"
            style={{ width: 120, padding: '4px 8px', fontSize: 14 }}
            value={restInput}
            onChange={e => setRestInput(e.target.value)}
            placeholder="Rest until room #"
            aria-label={`Set resting until room for ${player.name}`}
          />
          <button
            data-testid={`btn-override-set-resting-${player.id}`}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: 13 }}
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
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 13 }}
            onClick={() => dispatch({ t: 'OVERRIDE_SET_RESTING', player: player.id })}
          >
            Clear Resting
          </button>
        </div>
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
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', alignItems: 'center' }}>
        <button
          data-testid="btn-undo-last"
          className="btn btn-secondary"
          style={{ fontSize: 14, padding: '6px 14px' }}
          onClick={() => undo()}
        >
          Undo Last
        </button>
        <button
          data-testid="btn-override-toggle"
          className="btn btn-ghost"
          style={{ fontSize: 14, padding: '6px 14px' }}
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
        >
          GM Overrides {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div data-testid="override-panel-body"
             className="panel"
             style={{ margin: '0 16px 16px', overflow: 'visible' }}>
          <div className="panel-head">
            <h3 style={{ fontSize: 15, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              GM Overrides
            </h3>
          </div>
          <div className="panel-body" style={{ gap: 16 }}>

            {/* ── Heat ── */}
            <section data-testid="override-section-heat">
              <span className="t-label" style={{ display: 'block', marginBottom: 6 }}>
                Heat ({heat}/{hMax})
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  data-testid="btn-override-adjust-heat-minus"
                  className="btn btn-danger"
                  style={{ padding: '4px 12px', fontSize: 14 }}
                  onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_HEAT', delta: -1 })}
                >
                  Heat -1
                </button>
                <button
                  data-testid="btn-override-adjust-heat-plus"
                  className="btn btn-danger"
                  style={{ padding: '4px 12px', fontSize: 14 }}
                  onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_HEAT', delta: 1 })}
                >
                  Heat +1
                </button>
                <input
                  data-testid="override-heat-input"
                  type="number"
                  className="inp"
                  style={{ width: 70, padding: '4px 8px', fontSize: 14 }}
                  value={heatInput}
                  onChange={e => setHeatInput(e.target.value)}
                  aria-label="Set heat value"
                />
                <button
                  data-testid="btn-override-set-heat"
                  className="btn btn-danger"
                  style={{ padding: '4px 12px', fontSize: 14 }}
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
              </div>
            </section>

            {/* ── Loot ── */}
            <section data-testid="override-section-loot">
              <span className="t-label" style={{ display: 'block', marginBottom: 6 }}>
                Loot ({loot})
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  data-testid="btn-override-adjust-loot-minus"
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', fontSize: 14 }}
                  onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_LOOT', delta: -1 })}
                >
                  Loot -1
                </button>
                <button
                  data-testid="btn-override-adjust-loot-plus"
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', fontSize: 14 }}
                  onClick={() => dispatch({ t: 'OVERRIDE_ADJUST_LOOT', delta: 1 })}
                >
                  Loot +1
                </button>
                <input
                  data-testid="override-loot-input"
                  type="number"
                  className="inp"
                  style={{ width: 70, padding: '4px 8px', fontSize: 14 }}
                  value={lootInput}
                  onChange={e => setLootInput(e.target.value)}
                  aria-label="Set loot value"
                />
                <button
                  data-testid="btn-override-set-loot"
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', fontSize: 14 }}
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
              </div>
            </section>

            {/* ── Per-player ── */}
            {crew.map(player => (
              <PlayerOverrides key={player.id} player={player} dispatch={dispatch} />
            ))}

            {/* ── Room ── */}
            <section data-testid="override-section-room">
              <span className="t-label" style={{ display: 'block', marginBottom: 6 }}>Room</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  data-testid="btn-override-reroll-room"
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', fontSize: 14 }}
                  onClick={() => dispatch({ t: 'OVERRIDE_REROLL_ROOM' })}
                >
                  Re-roll Room
                </button>
                <button
                  data-testid="btn-override-skip-room"
                  className="btn btn-danger"
                  style={{ padding: '4px 12px', fontSize: 14 }}
                  onClick={() => dispatch({ t: 'OVERRIDE_SKIP_ROOM' })}
                >
                  Skip Room
                </button>
              </div>
            </section>

            {/* ── Phase jump ── */}
            <section data-testid="override-section-phase">
              <span className="t-label" style={{ display: 'block', marginBottom: 6 }}>Phase</span>
              <select
                data-testid="override-phase-select"
                className="inp"
                style={{ fontSize: 14, padding: '6px 10px' }}
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
        </div>
      )}
    </div>
  );
}
