import { useState } from 'react';
import {
  Volume2,
  SlidersHorizontal,
  Settings,
  Package,
  RotateCcw,
} from 'lucide-react';
import { useGameStore } from '@/console/store';
import type { GearId, PlayerId, Lane } from '@/engine';
import type { GearDef } from '@/engine/config';
import type { GearGrantDescriptor } from '@/engine/types';
import { Drawer } from './overlays';
import { Dialog } from './overlays';
import { OverridePanel } from '@/console/overrides';
import { Soundboard } from '@/console/soundboard';
import { SettingsDialog } from '@/console/settings';
import { ConfirmDialog } from './ConfirmDialog';
import { isGrantDescriptor, resolveGearDescriptor, gearItemLabel } from '@/console/gear-assign-util';

type ToolOverlay = 'soundboard' | 'overrides' | 'settings' | 'gear' | null;

interface GearAssignRowProps {
  item: GearId | GearGrantDescriptor;
  index: number;
  gearCatalog: Record<string, GearDef>;
  crew: Array<{ id: PlayerId; name: string }>;
  onAssign: (to: PlayerId, gearId: GearId, gearIndex: number) => void;
}

function GearAssignRow({ item, index, gearCatalog, crew, onAssign }: GearAssignRowProps) {
  const isDescriptor = isGrantDescriptor(item);
  const availableLanes: Lane[] = isDescriptor
    ? ((item.lanes ?? (item.lane ? [item.lane] : [])) as Lane[])
    : [];
  const needsLane = isDescriptor && availableLanes.length > 1;
  const [laneChoice, setLaneChoice] = useState<Lane | ''>(
    needsLane ? '' : (availableLanes[0] ?? ''),
  );
  const [playerChoice, setPlayerChoice] = useState<PlayerId | ''>('');

  const rowId = isDescriptor ? `grant-${index}` : String(item);
  const label = gearItemLabel(item, gearCatalog);

  const resolvedId: GearId | undefined = isDescriptor && laneChoice
    ? resolveGearDescriptor(item, laneChoice as Lane, gearCatalog)
    : isDescriptor ? undefined : (item as GearId);

  function handleAssign() {
    if (!resolvedId || !playerChoice) return;
    onAssign(playerChoice as PlayerId, resolvedId, index);
    setPlayerChoice('');
  }

  return (
    <div className="gear-assign-row" data-testid={`gear-assign-row-${rowId}`}>
      <span data-testid={`gear-assign-label-${rowId}`}>{label}</span>
      {needsLane && (
        <select
          value={laneChoice}
          onChange={(e) => setLaneChoice(e.target.value as Lane)}
          data-testid={`gear-assign-lane-${rowId}`}
          aria-label="Choose lane"
        >
          <option value="">Pick lane…</option>
          {availableLanes.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      )}
      <select
        value={playerChoice}
        onChange={(e) => setPlayerChoice(e.target.value as PlayerId)}
        data-testid={`gear-assign-player-${rowId}`}
        aria-label={`Assign ${label} to crew member`}
      >
        <option value="">Select player…</option>
        {crew.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        type="button"
        data-testid={`gear-assign-btn-${rowId}`}
        onClick={handleAssign}
        disabled={!resolvedId || !playerChoice}
      >
        Assign
      </button>
    </div>
  );
}

/**
 * Right-rail tool launchers + persistent Undo button.
 *
 * Renders icon buttons that open overlays (Soundboard drawer, GM Overrides
 * drawer, Settings dialog, Gear dialog). Overlays use `position: absolute` so
 * they escape the rail and position relative to the nearest `.cockpit` root.
 * The Undo button is always visible — one tap, no modal.
 */
export function ToolRail() {
  const [open, setOpen] = useState<ToolOverlay>(null);
  const [confirmNewJob, setConfirmNewJob] = useState(false);

  const undo = useGameStore(s => s.undo);
  const goAgain = useGameStore(s => s.goAgain);
  const dispatch = useGameStore(s => s.dispatch);
  const earnedGear = useGameStore(s => s.session.present.earnedGear);
  const crew = useGameStore(s => s.session.present.crew);
  const crewName = useGameStore(s => s.session.present.crewName);
  const gearCatalog = useGameStore(s => s.cfg.gear);

  const hasGear = earnedGear.length > 0;
  const inRun = crew.length > 0;

  function handleGearAssign(to: PlayerId, gearId: GearId, earnedGearIndex: number) {
    dispatch({ t: 'ASSIGN_GEAR', gear: gearId, to, earnedGearIndex });
  }

  function closeOverlay() {
    setOpen(null);
  }

  function handleNewJob() {
    setOpen(null);
    setConfirmNewJob(true);
  }

  function handleConfirmNewJob() {
    goAgain();
    setConfirmNewJob(false);
  }

  return (
    <>
      {/* ── Rail icons (static, in grid area "tools") ── */}
      <div
        className="cockpit-toolrail-icons"
        data-testid="tool-rail"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          flex: 1,
        }}
      >
        {/* Soundboard */}
        <button
          type="button"
          className={`cockpit-tool-btn${open === 'soundboard' ? ' active' : ''}`}
          data-testid="btn-tool-soundboard"
          aria-label="Soundboard"
          aria-pressed={open === 'soundboard'}
          onClick={() => setOpen(v => v === 'soundboard' ? null : 'soundboard')}
        >
          <Volume2 size={20} strokeWidth={1.75} />
        </button>

        {/* GM Overrides */}
        {inRun && (
          <button
            type="button"
            className={`cockpit-tool-btn${open === 'overrides' ? ' active' : ''}`}
            data-testid="btn-tool-overrides"
            aria-label="GM Overrides"
            aria-pressed={open === 'overrides'}
            onClick={() => setOpen(v => v === 'overrides' ? null : 'overrides')}
          >
            <SlidersHorizontal size={20} strokeWidth={1.75} />
          </button>
        )}

        {/* Settings */}
        <button
          type="button"
          className={`cockpit-tool-btn${open === 'settings' ? ' active' : ''}`}
          data-testid="btn-tool-settings"
          aria-label="Settings"
          aria-pressed={open === 'settings'}
          onClick={() => setOpen(v => v === 'settings' ? null : 'settings')}
        >
          <Settings size={20} strokeWidth={1.75} />
        </button>

        {/* Gear — badge when earnedGear is non-empty */}
        {inRun && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`cockpit-tool-btn${open === 'gear' ? ' active' : ''}`}
              data-testid="btn-tool-gear"
              aria-label="Gear"
              aria-pressed={open === 'gear'}
              onClick={() => setOpen(v => v === 'gear' ? null : 'gear')}
            >
              <Package size={20} strokeWidth={1.75} />
            </button>
            {hasGear && (
              <span
                className="cockpit-tool-badge"
                data-testid="tool-gear-badge"
                aria-label={`${earnedGear.length} unassigned gear item${earnedGear.length !== 1 ? 's' : ''}`}
              >
                {earnedGear.length}
              </span>
            )}
          </div>
        )}

        {/* Spacer pushes Undo to bottom */}
        <div style={{ flex: 1 }} />

        {/* Undo — persistent, always one tap */}
        <button
          type="button"
          className="cockpit-tool-btn undo"
          data-testid="btn-undo-last"
          aria-label="Undo last action"
          onClick={() => undo()}
        >
          <RotateCcw size={20} strokeWidth={1.75} />
        </button>
      </div>

      {/* ── Overlays (position: absolute relative to .cockpit root) ── */}

      {open === 'soundboard' && (
        <Drawer
          title="Soundboard"
          icon={<Volume2 size={20} />}
          side="right"
          wide
          onClose={closeOverlay}
          data-testid="drawer-soundboard"
        >
          <Soundboard fullBoard />
        </Drawer>
      )}

      {open === 'overrides' && inRun && (
        <Drawer
          title="GM Overrides"
          icon={<SlidersHorizontal size={20} />}
          side="right"
          onClose={closeOverlay}
          data-testid="drawer-overrides"
        >
          <OverridePanel />
        </Drawer>
      )}

      {open === 'settings' && (
        inRun
          ? <SettingsDialog onClose={closeOverlay} onNewJob={handleNewJob} />
          : <SettingsDialog onClose={closeOverlay} />
      )}

      {open === 'gear' && inRun && (
        <Dialog
          title="Assign Gear"
          onClose={closeOverlay}
          data-testid="dialog-gear"
        >
          {earnedGear.length === 0 ? (
            <p data-testid="gear-dialog-empty">No gear to assign.</p>
          ) : (
            <div data-testid="gear-assign-list">
              {earnedGear.map((item, idx) => (
                <GearAssignRow
                  key={idx}
                  item={item}
                  index={idx}
                  gearCatalog={gearCatalog}
                  crew={crew.map(p => ({ id: p.id, name: p.name }))}
                  onAssign={handleGearAssign}
                />
              ))}
            </div>
          )}
        </Dialog>
      )}

      {confirmNewJob && (
        <ConfirmDialog
          title="New Job"
          message={
            crewName
              ? `${crewName} are mid-job — abandoning clears the run and the save. This can't be undone.`
              : "Start a new job? Your current run will be abandoned and all progress lost."
          }
          confirmLabel="Abandon & New Job"
          onConfirm={handleConfirmNewJob}
          onClose={() => setConfirmNewJob(false)}
          data-testid="confirm-new-job"
        />
      )}
    </>
  );
}
