import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { PhaseHead, Panel, ActionBar, Button } from '@/console/ui';
import { DiceModeControl } from '@/console/settings/DiceModeControl';
import type { QuirkId } from '@/engine';
import type { QuirkDef } from '@/engine/config';
import type { LeaderboardEntry } from '@/content/schema/leaderboard';
import { formatLoot } from '@/content/format';

// ── Quirk label helper ────────────────────────────────────────────────────────

function quirkEffectLabel(quirk: QuirkDef): string {
  return quirk.boosts
    .map(b => `+${b.magnitude} ${b.lane.slice(0, 3).toUpperCase()}`)
    .join(' / ');
}

// ── Personal best leaderboard ─────────────────────────────────────────────────

interface LeaderboardSectionProps {
  entries: LeaderboardEntry[];
}

function LeaderboardSection({ entries }: LeaderboardSectionProps) {
  const top5 = entries.slice(0, 5);
  return (
    <div
      className="panel"
      style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: 18,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        Personal best
      </div>
      {entries.length === 0 ? (
        <p className="prose muted" style={{ padding: '12px 16px', margin: 0 }}>
          Complete your first run to see scores here.
        </p>
      ) : (
        top5.map((entry, i) => (
          <div
            key={entry.runSeed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-faint)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-data)',
                fontWeight: 800,
                fontSize: 16,
                color: i === 0 ? 'var(--accent)' : 'var(--fg-faint)',
                width: 24,
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                textTransform: 'uppercase',
                fontSize: 17,
                color: 'var(--fg)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.crewName || '—'}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-data)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--accent)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatLoot(entry.score)}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: 12,
                color: 'var(--fg-faint)',
                width: 54,
                textAlign: 'right',
              }}
            >
              H {entry.heatAtGetaway}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────

interface PlayerRow {
  name: string;
  quirk: string;
}

function defaultRows(count: number, defaultQuirkId: string): PlayerRow[] {
  return Array.from({ length: count }, () => ({ name: '', quirk: defaultQuirkId }));
}

// ── Setup screen ──────────────────────────────────────────────────────────────

export function Setup() {
  const startRun = useGameStore(s => s.startRun);
  const hasResumableSave = useGameStore(s => s.hasResumableSave);
  const staleSaveNotice = useGameStore(s => s.staleSaveNotice);
  const acceptResume = useGameStore(s => s.acceptResume);
  const leaderboard = useGameStore(s => s.leaderboard);
  const cfg = useGameStore(s => s.cfg);
  const session = useGameStore(s => s.session);

  const quirkList = Object.values(cfg.quirks);
  const defaultQuirkId = quirkList.length > 0 ? quirkList[0]!.id : '';

  const [crewName, setCrewName] = useState('');
  const [crewSize, setCrewSize] = useState(3);
  const [rows, setRows] = useState<PlayerRow[]>(() => defaultRows(3, defaultQuirkId));
  const [seedInput, setSeedInput] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  function handleCrewSizeChange(n: number) {
    setCrewSize(n);
    setRows(prev => {
      if (n > prev.length) {
        return [...prev, ...defaultRows(n - prev.length, defaultQuirkId)];
      }
      return prev.slice(0, n);
    });
  }

  function handleRowChange(idx: number, field: 'name' | 'quirk', value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function handleNewJob() {
    const parsedSeed = seedInput.trim() !== '' ? parseInt(seedInput, 10) : undefined;
    // Math.random is permitted outside the engine; the engine receives the resolved seed.
    const validSeed = parsedSeed !== undefined && !isNaN(parsedSeed)
      ? parsedSeed
      : (Math.random() * 0xFFFF_FFFF) >>> 0;
    const crew = rows.map(r => ({
      name: r.name.trim() || 'Player',
      ...(r.quirk !== '' && { quirk: r.quirk as QuirkId }),
    }));
    startRun(crew, validSeed, crewName.trim());
  }

  // ── Resume vs New job ─────────────────────────────────────────────────────

  if (hasResumableSave && !showNewForm) {
    const s = session.present;
    const displayCrew = s.crewName || 'Saved Job';
    return (
      <div className="stage-inner" data-testid="screen-setup">
        <PhaseHead eyebrow="01 · Setup" title="Welcome Back" />
        {staleSaveNotice && (
          <p data-testid="stale-save-notice" className="prose muted">
            Previous save was corrupt or outdated — starting fresh.
          </p>
        )}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, flex: 1, minHeight: 0 }}
        >
          {/* Choices column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Resume card */}
            <button
              type="button"
              data-testid="btn-resume"
              onClick={acceptResume}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 20,
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-panel)',
                boxShadow: 'var(--glow-accent)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--dur-base, 200ms) var(--ease-out, ease)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                }}
              >
                Saved job found
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontSize: 30,
                  letterSpacing: '-.01em',
                  color: 'var(--fg)',
                  margin: 0,
                }}
              >
                Resume · {displayCrew}
              </h3>
              <div
                style={{
                  display: 'flex',
                  gap: 18,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                  marginTop: 2,
                }}
              >
                {[
                  { k: 'Room',  v: String(s.roomIndex + 1),  color: 'var(--fg)' },
                  { k: 'Heat',  v: String(s.heat).padStart(2, '0'), color: s.heat > 10 ? 'var(--danger)' : 'var(--fg)' },
                  { k: 'Loot',  v: formatLoot(s.loot),       color: 'var(--accent)' },
                  { k: 'Crew',  v: String(s.crew.length),    color: 'var(--fg)' },
                ].map(({ k, v, color }) => (
                  <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 10,
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        color: 'var(--fg-faint)',
                      }}
                    >
                      {k}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-data)',
                        fontWeight: 800,
                        fontSize: 21,
                        color,
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </button>

            {/* New job card */}
            <button
              type="button"
              data-testid="btn-new-job"
              onClick={() => setShowNewForm(true)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 20,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-panel)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--dur-base, 200ms) var(--ease-out, ease)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-faint)',
                }}
              >
                Fresh start
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontSize: 30,
                  letterSpacing: '-.01em',
                  color: 'var(--fg)',
                  margin: 0,
                }}
              >
                Start a new job
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  color: 'var(--fg-muted)',
                  margin: 0,
                }}
              >
                Clears the save. Assemble a new crew and pick a new mark.
              </p>
            </button>
          </div>

          {/* Leaderboard column */}
          <LeaderboardSection entries={leaderboard} />
        </div>
      </div>
    );
  }

  // ── New job form ──────────────────────────────────────────────────────────

  return (
    <div className="stage-inner" data-testid="screen-setup">
      <PhaseHead eyebrow="01 · Setup" title="Assemble the Crew" />
      {staleSaveNotice && (
        <p data-testid="stale-save-notice" className="prose muted">
          Previous save was corrupt or outdated — starting fresh.
        </p>
      )}
      <LeaderboardSection entries={leaderboard} />
      <Panel>
        {/*
         * Hidden select preserves the crew-size-select testid for the test
         * suite which drives crew-size changes via fireEvent.change(select, …).
         * Visual control is the stepper below.
         */}
        <select
          id="crew-size-select"
          data-testid="crew-size-select"
          value={crewSize}
          onChange={e => handleCrewSizeChange(parseInt(e.target.value, 10))}
          style={{ display: 'none' }}
        >
          {[2, 3, 4, 5, 6, 7].map(n => (
            <option key={n} value={n}>{n} players</option>
          ))}
        </select>

        {/* Top row: crew size stepper + crew name */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 16,
            marginBottom: 'var(--space-3)',
          }}
        >
          <div className="field">
            <label>Players at the table</label>
            <div className="stepper">
              <button
                type="button"
                onClick={() => handleCrewSizeChange(Math.max(2, crewSize - 1))}
                disabled={crewSize <= 2}
              >
                &minus;
              </button>
              <span className="val">{crewSize}</span>
              <button
                type="button"
                onClick={() => handleCrewSizeChange(Math.min(7, crewSize + 1))}
                disabled={crewSize >= 7}
              >
                +
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="crew-name-input">Crew name</label>
            <input
              id="crew-name-input"
              data-testid="crew-name-input"
              type="text"
              className="inp"
              value={crewName}
              onChange={e => setCrewName(e.target.value)}
              placeholder="The Magpies"
            />
          </div>
        </div>

        {/* Player rows */}
        <div data-testid="player-rows">
          {rows.map((row, idx) => (
            <div
              key={idx}
              data-testid={`player-row-${idx}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '34px 1fr 1fr',
                gap: 12,
                alignItems: 'center',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '9px 12px',
                marginBottom: 7,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontWeight: 800,
                  fontSize: 15,
                  color: 'var(--fg-faint)',
                  textAlign: 'center',
                }}
              >
                {idx + 1}
              </span>
              <input
                id={`player-name-${idx}`}
                data-testid={`player-name-${idx}`}
                type="text"
                className="inp"
                value={row.name}
                onChange={e => handleRowChange(idx, 'name', e.target.value)}
                placeholder={`Player ${idx + 1}`}
              />
              <select
                id={`player-quirk-${idx}`}
                data-testid={`player-quirk-${idx}`}
                className="inp"
                value={row.quirk}
                onChange={e => handleRowChange(idx, 'quirk', e.target.value)}
                style={{ fontSize: 14 }}
              >
                {quirkList.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.name} — {quirkEffectLabel(q)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Advanced disclosure */}
        <details data-testid="advanced-disclosure" style={{ marginTop: 'var(--space-3)' }}>
          <summary
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 12,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px 0',
            }}
          >
            Advanced
          </summary>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginTop: 'var(--space-3)',
              borderTop: '1px solid var(--border)',
              paddingTop: 16,
            }}
          >
            <div className="field">
              <label>Dice mode</label>
              <DiceModeControl variant="cards" />
            </div>
            <div className="field">
              <label htmlFor="seed-input">
                Seed{' '}
                <span
                  style={{
                    color: 'var(--fg-faint)',
                    textTransform: 'none',
                    letterSpacing: 0,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                  }}
                >
                  (optional — reproduces a run)
                </span>
              </label>
              <input
                id="seed-input"
                data-testid="seed-input"
                type="number"
                className="inp"
                value={seedInput}
                onChange={e => setSeedInput(e.target.value)}
                placeholder="(random)"
              />
            </div>
          </div>
        </details>
      </Panel>

      <ActionBar
        left={
          showNewForm ? (
            <Button
              kind="ghost"
              data-testid="btn-cancel"
              onClick={() => setShowNewForm(false)}
            >
              Cancel
            </Button>
          ) : undefined
        }
        right={
          <Button
            kind="primary"
            data-testid="btn-start-run"
            onClick={handleNewJob}
          >
            {showNewForm ? 'Start new job' : 'Start job'}
          </Button>
        }
      />
    </div>
  );
}
