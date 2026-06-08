import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { PhaseHead, Panel, ActionBar, Button, Checklist } from '@/console/ui';
import type { ChecklistItem } from '@/console/ui';
import { DiceModeControl } from '@/console/settings/DiceModeControl';
import type { QuirkId } from '@/engine';
import type { LeaderboardEntry } from '@/content/schema/leaderboard';

const SETUP_CHECKLIST: ChecklistItem[] = [
  { label: 'Shuffle the Room deck and place it face-down' },
  { label: 'Deal one Gear card to each player, face-down' },
  { label: 'Set the Heat track to zero' },
  { label: 'The Mastermind reads the Briefing aloud' },
];

// ── Leaderboard section ───────────────────────────────────────────────────────

interface LeaderboardSectionProps {
  entries: LeaderboardEntry[];
}

function LeaderboardSection({ entries }: LeaderboardSectionProps) {
  const top5 = entries.slice(0, 5);
  const tag = entries.length === 0 ? 'No runs yet' : 'Beat that number';
  return (
    <Panel title="Leaderboard" tag={tag}>
      {entries.length === 0 ? (
        <p className="prose muted">Complete your first run to see scores here.</p>
      ) : (
        <div className="checklist">
          {top5.map((entry, i) => (
            <div key={entry.runSeed} className="check done">
              <span
                className="box"
                style={{ fontFamily: 'var(--font-data)', fontWeight: 800 }}
              >
                {i + 1}
              </span>
              <span style={{ fontFamily: 'var(--font-data)', fontWeight: 800, fontSize: 18 }}>
                {entry.score.toLocaleString()}
              </span>
              <span
                style={{
                  color: entry.win ? 'var(--accent)' : 'var(--danger)',
                  fontFamily: 'var(--font-data)',
                  fontSize: 12,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                }}
              >
                {entry.win ? 'WIN' : 'BUST'}
              </span>
              <span
                style={{
                  color: 'var(--fg-faint)',
                  fontFamily: 'var(--font-data)',
                  fontSize: 12,
                  marginLeft: 'auto',
                }}
              >
                ${(entry.loot / 1000).toFixed(1)}k · {entry.crewSize}p
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────

interface PlayerRow {
  name: string;
  quirk: string;
}

function defaultRows(count: number): PlayerRow[] {
  return Array.from({ length: count }, () => ({ name: '', quirk: '' }));
}

// ── Setup screen ──────────────────────────────────────────────────────────────

export function Setup() {
  const startRun = useGameStore(s => s.startRun);
  const hasResumableSave = useGameStore(s => s.hasResumableSave);
  const staleSaveNotice = useGameStore(s => s.staleSaveNotice);
  const acceptResume = useGameStore(s => s.acceptResume);
  const leaderboard = useGameStore(s => s.leaderboard);

  const [crewSize, setCrewSize] = useState(3);
  const [rows, setRows] = useState<PlayerRow[]>(defaultRows(3));
  const [seedInput, setSeedInput] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  function handleCrewSizeChange(n: number) {
    setCrewSize(n);
    setRows(prev => {
      if (n > prev.length) {
        return [...prev, ...defaultRows(n - prev.length)];
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
      ...(r.quirk.trim() !== '' && { quirk: r.quirk.trim() as QuirkId }),
    }));
    startRun(crew, validSeed);
  }

  // ── Resume vs New job ─────────────────────────────────────────────────────

  if (hasResumableSave && !showNewForm) {
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
          <p className="prose">You have an in-progress job.</p>
        </Panel>
        <ActionBar
          left={
            <Button
              kind="secondary"
              data-testid="btn-new-job"
              onClick={() => setShowNewForm(true)}
            >
              New job
            </Button>
          }
          right={
            <Button
              kind="primary"
              data-testid="btn-resume"
              onClick={acceptResume}
            >
              Resume the job
            </Button>
          }
        />
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
      <div className="setup-grid">
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
          <div data-testid="player-rows">
            {rows.map((row, idx) => (
              <div key={idx} data-testid={`player-row-${idx}`}>
                <div className="field">
                  <label htmlFor={`player-name-${idx}`}>Player {idx + 1} name</label>
                  <input
                    id={`player-name-${idx}`}
                    data-testid={`player-name-${idx}`}
                    type="text"
                    className="inp"
                    value={row.name}
                    onChange={e => handleRowChange(idx, 'name', e.target.value)}
                    placeholder={`Player ${idx + 1}`}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`player-quirk-${idx}`}>Quirk (optional)</label>
                  <input
                    id={`player-quirk-${idx}`}
                    data-testid={`player-quirk-${idx}`}
                    type="text"
                    className="inp"
                    value={row.quirk}
                    onChange={e => handleRowChange(idx, 'quirk', e.target.value)}
                    placeholder="e.g. tech-ace"
                  />
                </div>
              </div>
            ))}
          </div>
          <details data-testid="advanced-disclosure" style={{ marginTop: 'var(--space-3)' }}>
            <summary style={{ fontFamily: 'var(--font-data)', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
              Advanced
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
              <div className="field">
                <label htmlFor="seed-input">Seed (optional, numeric)</label>
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
              <DiceModeControl />
            </div>
          </details>
        </Panel>
        <Panel tag="Setup checklist">
          <Checklist items={SETUP_CHECKLIST} />
        </Panel>
      </div>
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
