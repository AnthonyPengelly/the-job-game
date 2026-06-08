import { useState } from 'react';
import { useGameStore } from '@/console/store';
import type { RunPhase } from '@/engine';
import { formatLoot } from '@/content/format';

const ALL_PHASES: readonly RunPhase[] = [
  'briefing',
  'room',
  'minigame',
  'offer',
  'getaway',
  'result',
];

/**
 * GM Overrides — run-level controls only.
 *
 * Renders as drawer content (no drawer wrapper — the caller, ToolRail,
 * provides the Drawer shell). Covers Heat, Loot, Room, and Phase.
 * Per-player overrides have moved to the CrewDetailPopover (E13.2).
 * Undo has moved to the ToolRail persistent button (E13.3).
 */
export function OverridePanel() {
  const [heatInput, setHeatInput] = useState('');
  const [lootInput, setLootInput] = useState('');

  const dispatch = useGameStore(s => s.dispatch);
  const heat = useGameStore(s => s.session.present.heat);
  const loot = useGameStore(s => s.session.present.loot);
  const hMax = useGameStore(s => s.cfg.heat.hMax);

  return (
    <div data-testid="override-panel">

      {/* ── Heat ── */}
      <section data-testid="override-section-heat" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="t-label" style={{ display: 'block' }}>
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
      <section data-testid="override-section-loot" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="t-label" style={{ display: 'block' }}>
          Loot ({formatLoot(loot)})
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

      {/* ── Room ── */}
      <section data-testid="override-section-room" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="t-label" style={{ display: 'block' }}>Room</span>
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
      <section data-testid="override-section-phase" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="t-label" style={{ display: 'block' }}>Phase</span>
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
  );
}
