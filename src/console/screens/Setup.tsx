import { useState } from 'react';
import { useGameStore } from '@/console/store';
import type { QuirkId } from '@/engine';

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
    // Generate a random seed when none is supplied so each blank-field run differs.
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

  // When there's a resumable save and the GM hasn't chosen, show the choice.
  if (hasResumableSave && !showNewForm) {
    return (
      <div data-testid="screen-setup">
        <h2>The Job</h2>
        {staleSaveNotice && (
          <p data-testid="stale-save-notice">
            Previous save was corrupt or outdated — starting fresh.
          </p>
        )}
        <p>You have an in-progress job.</p>
        <button
          data-testid="btn-resume"
          onClick={acceptResume}
        >
          Resume the job
        </button>
        <button
          data-testid="btn-new-job"
          onClick={() => setShowNewForm(true)}
        >
          New job
        </button>
      </div>
    );
  }

  return (
    <div data-testid="screen-setup">
      <h2>The Job — Setup</h2>
      {staleSaveNotice && (
        <p data-testid="stale-save-notice">
          Previous save was corrupt or outdated — starting fresh.
        </p>
      )}
      <div>
        <label htmlFor="crew-size-select">Crew size</label>
        <select
          id="crew-size-select"
          data-testid="crew-size-select"
          value={crewSize}
          onChange={e => handleCrewSizeChange(parseInt(e.target.value, 10))}
        >
          {[2, 3, 4, 5, 6, 7].map(n => (
            <option key={n} value={n}>{n} players</option>
          ))}
        </select>
      </div>
      <div data-testid="player-rows">
        {rows.map((row, idx) => (
          <div key={idx} data-testid={`player-row-${idx}`}>
            <label htmlFor={`player-name-${idx}`}>Player {idx + 1} name</label>
            <input
              id={`player-name-${idx}`}
              data-testid={`player-name-${idx}`}
              type="text"
              value={row.name}
              onChange={e => handleRowChange(idx, 'name', e.target.value)}
              placeholder={`Player ${idx + 1}`}
            />
            <label htmlFor={`player-quirk-${idx}`}>Quirk (optional)</label>
            <input
              id={`player-quirk-${idx}`}
              data-testid={`player-quirk-${idx}`}
              type="text"
              value={row.quirk}
              onChange={e => handleRowChange(idx, 'quirk', e.target.value)}
              placeholder="e.g. tech-ace"
            />
          </div>
        ))}
      </div>
      <div>
        <label htmlFor="seed-input">Seed (optional, numeric)</label>
        <input
          id="seed-input"
          data-testid="seed-input"
          type="number"
          value={seedInput}
          onChange={e => setSeedInput(e.target.value)}
          placeholder="(random)"
        />
      </div>
      <button
        data-testid="btn-start-run"
        onClick={handleNewJob}
      >
        {showNewForm ? 'Start new job' : 'Start job'}
      </button>
      {showNewForm && (
        <button
          data-testid="btn-cancel"
          onClick={() => setShowNewForm(false)}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
