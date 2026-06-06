import { useState, useMemo } from 'react';
import { useGameStore } from '@/console/store';
import { useMonteCarlo } from './useMonteCarlo';
import { Distributions } from './Distributions';
import type { StorageLike, BuildConfigResult, PresetListEntry } from '@/platform';
import {
  listPresets,
  readPreset,
  writePreset,
  clonePreset,
  buildConfigFromTuning,
} from '@/platform';
import type { ParsedTuning } from '@/content/schema';
import type { UserPreset } from '@/content/schema';

// ── Field registry ─────────────────────────────────────────────────────────────

interface FieldDef {
  label: string;
  section: string;
  field: string;
  min: number;
  max: number;
  step: number;
}

const HEAT_FIELDS: readonly FieldDef[] = [
  { label: 'hMax — forced Getaway', section: 'heat', field: 'hMax', min: 1, max: 50, step: 1 },
  { label: 'runAtFraction — escape signal', section: 'heat', field: 'runAtFraction', min: 0.01, max: 0.99, step: 0.01 },
  { label: 'onsetRoom — escalation onset', section: 'escalation', field: 'onsetRoom', min: 0, max: 20, step: 1 },
  { label: 'rampPerObstacle — escalation step', section: 'escalation', field: 'rampPerObstacle', min: 0, max: 2, step: 0.05 },
  { label: 'safe — base obstacle Heat', section: 'obstacleHeat', field: 'safe', min: 0, max: 10, step: 0.5 },
  { label: 'greedy — greedy surcharge', section: 'obstacleHeat', field: 'greedy', min: 0, max: 10, step: 0.5 },
  { label: 'greedyBelowFraction — greedy threshold', section: 'obstacleHeat', field: 'greedyBelowFraction', min: 0.01, max: 0.99, step: 0.01 },
  { label: 'clean — outcome Heat', section: 'outcomeHeat', field: 'clean', min: 0, max: 10, step: 0.5 },
  { label: 'complication — outcome Heat', section: 'outcomeHeat', field: 'complication', min: 0, max: 10, step: 0.5 },
  { label: 'botched — outcome Heat', section: 'outcomeHeat', field: 'botched', min: 0, max: 10, step: 0.5 },
];

const GETAWAY_FIELDS: readonly FieldDef[] = [
  { label: 'exponent — curve shape', section: 'getaway', field: 'exponent', min: 0.1, max: 5, step: 0.1 },
  { label: 'skillTerm — skill contribution', section: 'getaway', field: 'skillTerm', min: 0.1, max: 2, step: 0.05 },
  { label: 'skillPivot — skill baseline', section: 'getaway', field: 'skillPivot', min: 0.01, max: 0.99, step: 0.01 },
  { label: 'headcountTerm — crew size contribution', section: 'getaway', field: 'headcountTerm', min: 0.1, max: 2, step: 0.05 },
];

const SCORING_FIELDS: readonly FieldDef[] = [
  { label: 'winBaseMultiplier — win score base', section: 'scoring', field: 'winBaseMultiplier', min: 0.1, max: 5, step: 0.1 },
  { label: 'lowHeatStyleBonus — style bonus at Heat 0', section: 'scoring', field: 'lowHeatStyleBonus', min: 0, max: 2, step: 0.05 },
  { label: 'bustMultiplier — bust score fraction', section: 'scoring', field: 'bustMultiplier', min: 0.01, max: 0.99, step: 0.01 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

// Deep-update one field in tuning. The `as ParsedTuning` cast is intentional:
// it allows out-of-range numeric values so Zod validation (buildConfigFromTuning)
// can surface them as clear human-readable errors rather than silently clamping.
function patchTuning(tuning: ParsedTuning, section: string, field: string, value: number): ParsedTuning {
  const sectionData = (tuning as Record<string, Record<string, unknown>>)[section] ?? {};
  return { ...tuning, [section]: { ...sectionData, [field]: value } } as ParsedTuning;
}

function getTuningValue(tuning: ParsedTuning, section: string, field: string): number {
  const sectionData = (tuning as Record<string, Record<string, unknown>>)[section];
  if (sectionData === undefined) return 0;
  const v = sectionData[field];
  return typeof v === 'number' ? v : 0;
}

function loadTuning(id: string, storage: StorageLike): ParsedTuning {
  const preset = readPreset(id, storage) ?? readPreset('default', storage);
  if (preset === null) throw new Error('[TuningPanel] Cannot load default preset tuning');
  // JSON round-trip deep-copies so the working copy is independent of storage.
  return JSON.parse(JSON.stringify(preset.tuning)) as ParsedTuning;
}

// ── FieldRow ───────────────────────────────────────────────────────────────────

interface FieldRowProps {
  def: FieldDef;
  value: number;
  onChange: (section: string, field: string, value: number) => void;
}

function FieldRow({ def, value, onChange }: FieldRowProps) {
  // The range slider is clamped to [min, max]; the number input allows
  // out-of-range values so the user can type and see a validation error.
  const sliderValue = Number.isNaN(value)
    ? def.min
    : Math.min(def.max, Math.max(def.min, value));

  return (
    <div
      data-testid={`tuning-field-${def.section}-${def.field}`}
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
    >
      <label
        htmlFor={`tuning-input-${def.section}-${def.field}`}
        style={{
          minWidth: 240,
          fontFamily: 'var(--ff-mono)',
          fontSize: 11,
          color: 'var(--fg-muted)',
          flexShrink: 0,
        }}
      >
        {def.label}
      </label>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={sliderValue}
        onChange={e => onChange(def.section, def.field, e.target.valueAsNumber)}
        style={{ flex: 1 }}
        aria-label={`${def.label} slider`}
      />
      <input
        id={`tuning-input-${def.section}-${def.field}`}
        type="number"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        data-testid={`input-${def.section}-${def.field}`}
        onChange={e => {
          const v = e.target.valueAsNumber;
          if (!Number.isNaN(v)) onChange(def.section, def.field, v);
        }}
        style={{
          width: 70,
          fontFamily: 'var(--ff-mono)',
          fontSize: 12,
          padding: '2px 4px',
          flexShrink: 0,
        }}
        aria-label={`${def.label} value`}
      />
    </div>
  );
}

// ── FieldGroup ─────────────────────────────────────────────────────────────────

interface FieldGroupProps {
  title: string;
  fields: readonly FieldDef[];
  tuning: ParsedTuning;
  onChange: (section: string, field: string, value: number) => void;
}

function FieldGroup({ title, fields, tuning, onChange }: FieldGroupProps) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--ff-mono)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--fg-faint)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {fields.map(def => (
        <FieldRow
          key={`${def.section}-${def.field}`}
          def={def}
          value={getTuningValue(tuning, def.section, def.field)}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

// ── TuningPanelBody ────────────────────────────────────────────────────────────

// Isolated in its own component so useMonteCarlo (Web Worker) only mounts when
// the panel is open, keeping app.test.tsx unaffected when the panel is closed.
interface TuningPanelBodyProps {
  storage: StorageLike;
  initialPresetId: string;
}

function TuningPanelBody({ storage, initialPresetId }: TuningPanelBodyProps) {
  const applyPreset = useGameStore(s => s.applyPreset);
  const storeApplyError = useGameStore(s => s.applyPresetError);
  const storeCfg = useGameStore(s => s.cfg);

  const [editingPresetId, setEditingPresetId] = useState(initialPresetId);
  const [workingTuning, setWorkingTuning] = useState<ParsedTuning>(() =>
    loadTuning(initialPresetId, storage),
  );
  const [presets, setPresets] = useState<PresetListEntry[]>(() => listPresets(storage));
  const [cloneName, setCloneName] = useState('');
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Validate working copy. Memoized so workingCfg is a stable reference when
  // workingTuning hasn't changed — prevents useMonteCarlo's effect from firing
  // on every render and creating a perpetual recompute loop.
  const validationResult: BuildConfigResult = useMemo(
    () => buildConfigFromTuning(workingTuning),
    [workingTuning],
  );
  // Feed distributions with working cfg (falls back to current store cfg when invalid).
  const workingCfg = validationResult.ok ? validationResult.cfg : storeCfg;

  const { result: mcResult, isRunning: mcRunning } = useMonteCarlo(workingCfg);

  function handleFieldChange(section: string, field: string, value: number): void {
    setWorkingTuning(prev => patchTuning(prev, section, field, value));
    setSaveMessage(null);
  }

  function handlePresetSwitch(id: string): void {
    setEditingPresetId(id);
    setWorkingTuning(loadTuning(id, storage));
    setSaveMessage(null);
    setShowCloneForm(false);
  }

  function handleClone(): void {
    const name = cloneName.trim();
    if (name === '') return;
    const cloned = clonePreset(editingPresetId, name, storage);
    // Overwrite the cloned preset's tuning with the working copy (captures unsaved edits).
    const updated: UserPreset = { ...cloned, tuning: workingTuning };
    writePreset(updated, storage);
    setPresets(listPresets(storage));
    setEditingPresetId(cloned.id);
    setCloneName('');
    setShowCloneForm(false);
    setSaveMessage('Cloned');
  }

  function handleSave(): void {
    if (editingPresetId === 'default' || !validationResult.ok) return;
    const preset = readPreset(editingPresetId, storage);
    if (preset === null) return;
    writePreset({ ...preset, tuning: workingTuning }, storage);
    setSaveMessage('Saved');
  }

  function handleSelect(): void {
    if (!validationResult.ok) return;
    // Persist working copy before selecting so applyPreset reads the current values.
    if (editingPresetId !== 'default') {
      const preset = readPreset(editingPresetId, storage);
      if (preset !== null) {
        writePreset({ ...preset, tuning: workingTuning }, storage);
      }
    }
    applyPreset(editingPresetId);
  }

  function handleReset(): void {
    setWorkingTuning(loadTuning(editingPresetId, storage));
    setSaveMessage(null);
  }

  const isDefault = editingPresetId === 'default';
  const canSelect = validationResult.ok;

  const errorText = !validationResult.ok
    ? validationResult.error
    : storeApplyError;

  return (
    <div
      data-testid="tuning-panel-body"
      style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* ── Preset selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label
          htmlFor="tuning-preset-select"
          style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-muted)' }}
        >
          Editing:
        </label>
        <select
          id="tuning-preset-select"
          data-testid="tuning-preset-select"
          value={editingPresetId}
          onChange={e => handlePresetSwitch(e.target.value)}
          style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, padding: '4px 8px' }}
        >
          {presets.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{p.isBuiltIn ? ' (default)' : ''}
            </option>
          ))}
        </select>
        <button
          data-testid="btn-tuning-select"
          className="btn btn-secondary"
          style={{ padding: '4px 12px', fontSize: 12 }}
          onClick={handleSelect}
          disabled={!canSelect}
        >
          Select / Play
        </button>
        <button
          data-testid="btn-tuning-clone-show"
          className="btn btn-ghost"
          style={{ padding: '4px 12px', fontSize: 12 }}
          onClick={() => setShowCloneForm(v => !v)}
        >
          Clone as…
        </button>
      </div>

      {/* ── Clone form ── */}
      {showCloneForm && (
        <div
          data-testid="tuning-clone-form"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <input
            data-testid="input-clone-name"
            type="text"
            value={cloneName}
            onChange={e => setCloneName(e.target.value)}
            placeholder="New preset name…"
            style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, padding: '4px 8px', flex: 1 }}
          />
          <button
            data-testid="btn-tuning-clone-confirm"
            className="btn btn-secondary"
            style={{ padding: '4px 12px', fontSize: 12 }}
            onClick={handleClone}
            disabled={cloneName.trim() === ''}
          >
            Clone
          </button>
          <button
            data-testid="btn-tuning-clone-cancel"
            className="btn btn-ghost"
            style={{ padding: '4px 12px', fontSize: 12 }}
            onClick={() => { setShowCloneForm(false); setCloneName(''); }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Validation / apply error ── */}
      {errorText !== null && errorText !== undefined && errorText !== '' && (
        <div
          data-testid="tuning-validation-error"
          style={{
            color: 'var(--caution, #e8a000)',
            fontFamily: 'var(--ff-mono)',
            fontSize: 11,
            padding: '6px 8px',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          {errorText}
        </div>
      )}

      {/* ── Heat & Escalation ── */}
      <FieldGroup
        title="Heat & Escalation"
        fields={HEAT_FIELDS}
        tuning={workingTuning}
        onChange={handleFieldChange}
      />

      {/* ── Getaway ── */}
      <FieldGroup
        title="Getaway"
        fields={GETAWAY_FIELDS}
        tuning={workingTuning}
        onChange={handleFieldChange}
      />

      {/* ── Scoring ── */}
      <FieldGroup
        title="Scoring"
        fields={SCORING_FIELDS}
        tuning={workingTuning}
        onChange={handleFieldChange}
      />

      {/* ── Distributions ── */}
      <Distributions result={mcResult} isRunning={mcRunning} />

      {/* ── Footer: save / reset ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!isDefault && (
          <button
            data-testid="btn-tuning-save"
            className="btn btn-secondary"
            style={{ padding: '4px 12px', fontSize: 12 }}
            onClick={handleSave}
            disabled={!validationResult.ok}
          >
            Save
          </button>
        )}
        <button
          data-testid="btn-tuning-reset"
          className="btn btn-ghost"
          style={{ padding: '4px 12px', fontSize: 12 }}
          onClick={handleReset}
        >
          Reset
        </button>
        {saveMessage !== null && (
          <span
            data-testid="tuning-save-message"
            style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--accent)' }}
          >
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
}

// ── TuningPanel ────────────────────────────────────────────────────────────────

interface TuningPanelProps {
  /** Inject storage for tests; defaults to window.localStorage in browser. */
  storage?: StorageLike;
}

/**
 * GM-only tuning panel: sliders for Heat / Getaway / scoring constants with
 * live Monte Carlo distributions, clone / save / select preset controls.
 * Mounted only in the console shell — never in player-view.
 */
export function TuningPanel({ storage: storageProp }: TuningPanelProps = {}) {
  const [open, setOpen] = useState(false);
  const activePresetId = useGameStore(s => s.activePresetId);
  // Prefer injected storage (tests); fall back to window.localStorage in browser.
  const storage = storageProp ?? window.localStorage;

  return (
    <div data-testid="tuning-panel">
      <button
        data-testid="btn-tuning-toggle"
        className="btn btn-ghost"
        style={{ fontSize: 14, padding: '6px 14px' }}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        Tuning Panel {open ? '▲' : '▼'}
      </button>
      {open && (
        <div
          data-testid="tuning-panel-open"
          className="panel"
          style={{ margin: '0 16px 16px', overflow: 'visible' }}
        >
          <div className="panel-head">
            <h3 style={{ fontSize: 15, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Tuning — GM Only
            </h3>
          </div>
          <TuningPanelBody storage={storage} initialPresetId={activePresetId} />
        </div>
      )}
    </div>
  );
}
