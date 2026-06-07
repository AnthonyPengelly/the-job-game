import { useState } from 'react';
import {
  Volume2,
  SlidersHorizontal,
  Settings,
  Package,
  RotateCcw,
} from 'lucide-react';
import { useGameStore } from '@/console/store';
import { Drawer } from './overlays';
import { OverridePanel } from '@/console/overrides';
import { Soundboard } from '@/console/soundboard';
import { SettingsDialog } from '@/console/settings';
import { ConfirmDialog } from './ConfirmDialog';

type ToolOverlay = 'soundboard' | 'overrides' | 'settings' | null;

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
  const earnedGear = useGameStore(s => s.session.present.earnedGear);
  const crew = useGameStore(s => s.session.present.crew);

  const hasGear = earnedGear.length > 0;
  const inRun = crew.length > 0;

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
              className="cockpit-tool-btn"
              data-testid="btn-tool-gear"
              aria-label="Gear"
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
          <Soundboard />
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

      {confirmNewJob && (
        <ConfirmDialog
          title="New Job"
          message="Start a new job? Your current run will be abandoned and all progress lost."
          confirmLabel="Abandon & New Job"
          onConfirm={handleConfirmNewJob}
          onClose={() => setConfirmNewJob(false)}
          data-testid="confirm-new-job"
        />
      )}
    </>
  );
}
