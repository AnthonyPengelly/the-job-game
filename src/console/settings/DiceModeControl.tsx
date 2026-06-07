import { useGameStore } from '@/console/store';
import { useAudioSettings } from '@/console/audio';
import type { DiceMode } from '@/content/schema/settings';
import { Dialog } from '@/console/shell/overlays';
import { Settings } from 'lucide-react';
import { TuningPanel } from '@/console/tuning';

/**
 * Settings dialog: dice-mode, audio, seed, and dev tuning panel.
 * Opened from the ToolRail Settings launcher (E13.3).
 * Never rendered to the player-view.
 */
interface SettingsDialogProps {
  onClose: () => void;
  onNewJob?: () => void;
}

export function SettingsDialog({ onClose, onNewJob }: SettingsDialogProps) {
  const diceMode = useGameStore(s => s.diceMode);
  const setDiceMode = useGameStore(s => s.setDiceMode);
  const runSeed = useGameStore(s => s.runSeed);
  const crew = useGameStore(s => s.session.present.crew);

  const audioSettings = useAudioSettings();

  function handleDiceMode(e: React.ChangeEvent<HTMLSelectElement>) {
    setDiceMode(e.target.value as DiceMode);
  }

  const hasRun = crew.length > 0;

  return (
    <Dialog
      title="Settings"
      icon={<Settings size={20} />}
      onClose={onClose}
      data-testid="settings-dialog"
      footer={
        hasRun && onNewJob !== undefined ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={onNewJob}
            data-testid="btn-settings-new-job"
            style={{ marginRight: 'auto' }}
          >
            New Job…
          </button>
        ) : undefined
      }
    >
      {/* ── Dice mode ── */}
      <section
        data-testid="dice-mode-control"
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <span
          className="t-label"
          style={{
            fontFamily: 'var(--font-data)',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--fg-faint)',
          }}
        >
          Dice mode
        </span>
        <label
          htmlFor="dice-mode-select"
          style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--fg-muted)' }}
        >
          {'Roll mode '}
          <select
            id="dice-mode-select"
            data-testid="dice-mode-select"
            value={diceMode}
            onChange={handleDiceMode}
            className="inp"
            style={{ fontSize: 13, padding: '4px 8px' }}
          >
            <option value="app">App roll</option>
            <option value="physical">Physical roll</option>
          </select>
        </label>
      </section>

      {/* ── Audio ── */}
      {audioSettings !== null && (
        <section
          data-testid="settings-audio"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <span
            className="t-label"
            style={{
              fontFamily: 'var(--font-data)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--fg-faint)',
            }}
          >
            Audio
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-settings-mute"
              onClick={() => audioSettings.setMuted(!audioSettings.muted)}
              aria-pressed={audioSettings.muted}
              style={{ fontSize: 13, padding: '4px 12px' }}
            >
              {audioSettings.muted ? 'Unmute' : 'Mute'}
            </button>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--fg-muted)' }}
            >
              Volume
              <input
                type="range"
                data-testid="input-settings-volume"
                min={0}
                max={1}
                step={0.01}
                value={audioSettings.volume}
                onChange={e => audioSettings.setVolume(parseFloat(e.target.value))}
                style={{ flex: 1, minWidth: 100 }}
              />
            </label>
          </div>
        </section>
      )}

      {/* ── Seed ── */}
      {hasRun && (
        <section
          data-testid="settings-seed"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <span
            className="t-label"
            style={{
              fontFamily: 'var(--font-data)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--fg-faint)',
            }}
          >
            Run seed
          </span>
          <span
            data-testid="settings-seed-value"
            style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--fg-muted)' }}
          >
            {runSeed}
          </span>
        </section>
      )}

      {/* ── Tuning (dev) ── */}
      <section data-testid="settings-tuning">
        <TuningPanel />
      </section>
    </Dialog>
  );
}

/** Standalone dice-mode selector. Used by the Setup screen and in tests. */
export function DiceModeControl() {
  const diceMode = useGameStore(s => s.diceMode);
  const setDiceMode = useGameStore(s => s.setDiceMode);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDiceMode(e.target.value as DiceMode);
  }

  return (
    <div data-testid="dice-mode-control">
      <label htmlFor="dice-mode-select">Dice mode</label>
      <select
        id="dice-mode-select"
        data-testid="dice-mode-select"
        value={diceMode}
        onChange={handleChange}
      >
        <option value="app">App roll</option>
        <option value="physical">Physical roll</option>
      </select>
    </div>
  );
}
