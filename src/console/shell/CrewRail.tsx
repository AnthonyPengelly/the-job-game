import { useState, useRef, useCallback } from 'react';
import { Tv, Users } from 'lucide-react';
import { useGameStore } from '@/console/store';
import { isResting } from '@/engine';
import type { PlayerId, GearId } from '@/engine';
import { CrewAvatar } from './CrewAvatar';
import { CrewDetailPopover } from './CrewDetailPopover';
import { useCrewRailMode } from './crewRailMode';

/**
 * The left crew rail — mounted inside `cockpit-crewrail` via the Cockpit's
 * `crewRail` prop.
 *
 * Renders all crew members as legible avatar cards. Supports three modes
 * driven by stage screens (via CrewRailModeContext, provided at the App level):
 *
 *   idle       — click opens the per-player detail popover (the override surface)
 *   commit     — multi-select N–M crew; feeds CHOOSE_OPTION.committed (E13.8)
 *   attempter  — single-select; feeds CHOOSE_SCENARIO.attemptedBy (E13.8)
 *
 * The rail scrolls internally at 7 players without scrolling the document.
 */
export function CrewRail() {
  const crew = useGameStore(s => s.session.present.crew);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const dispatch = useGameStore(s => s.dispatch);

  const {
    mode,
    committed,
    selectedAttempter,
    toggleCommit,
    pickAttempter,
  } = useCrewRailMode();

  const [openPopoverId, setOpenPopoverId] = useState<PlayerId | null>(null);

  const railRef = useRef<HTMLDivElement>(null);

  function handleAvatarClick(id: PlayerId) {
    if (mode === 'commit') {
      // Resting members cannot be committed
      const player = crew.find(p => p.id === id);
      if (player && isResting(player, roomIndex)) return;
      toggleCommit(id);
      return;
    }
    if (mode === 'attempter') {
      // Resting members cannot attempt
      const player = crew.find(p => p.id === id);
      if (player && isResting(player, roomIndex)) return;
      pickAttempter(id);
      return;
    }
    // idle: open detail popover
    setOpenPopoverId(prev => (prev === id ? null : id));
  }

  function handleGearDrop(gear: GearId, to: PlayerId, earnedGearIndex?: number) {
    dispatch({
      t: 'ASSIGN_GEAR',
      gear,
      to,
      ...(earnedGearIndex !== undefined && { earnedGearIndex }),
    });
  }

  const closePopover = useCallback(() => setOpenPopoverId(null), []);

  function picked(id: PlayerId): 'commit-on' | 'pick' | 'idle' {
    if (mode === 'commit') {
      if (committed.has(id)) return 'commit-on';
      const player = crew.find(p => p.id === id);
      if (player && !isResting(player, roomIndex)) return 'pick';
      return 'idle';
    }
    if (mode === 'attempter') {
      if (selectedAttempter === id) return 'commit-on';
      const player = crew.find(p => p.id === id);
      if (player && !isResting(player, roomIndex)) return 'pick';
      return 'idle';
    }
    return 'idle';
  }

  const openPlayer = crew.find(p => p.id === openPopoverId);

  // Mode label and chip class for the rail header
  const modeChipCls =
    mode === 'commit' ? 'mode committing'
    : mode === 'attempter' ? 'mode attempter'
    : 'mode default';
  const modeLabel =
    mode === 'commit' ? 'Commit'
    : mode === 'attempter' ? 'Pick one'
    : 'Roster';

  return (
    <div data-testid="crew-rail" style={{ display: 'contents' }}>
      {/* Header */}
      <div className="cockpit-crewrail-head">
        <span className="hl">
          <Users size={15} strokeWidth={1.75} aria-hidden="true" />
          Crew · {crew.length}
        </span>
        <span className={modeChipCls}>{modeLabel}</span>
      </div>

      {/* Avatar list — scrolls internally */}
      <div className="cockpit-crewrail-body" ref={railRef}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {crew.map(player => (
            <CrewAvatar
              key={player.id}
              player={player}
              roomIndex={roomIndex}
              railMode={mode}
              picked={picked(player.id)}
              onClick={handleAvatarClick}
              onGearDrop={handleGearDrop}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="cockpit-crewrail-foot">
        <button
          className="btn btn-ghost"
          onClick={() => window.open('player.html', 'the-job-player')}
          data-testid="open-player-view"
          aria-label="Open player view"
          style={{ fontSize: '13px', padding: '8px 14px', gap: '7px', width: '100%' }}
        >
          <Tv size={16} strokeWidth={1.75} aria-hidden="true" />
          Player view
        </button>
      </div>

      {/* Per-player detail popover */}
      {openPlayer !== undefined && (
        <CrewDetailPopover
          player={openPlayer}
          roomIndex={roomIndex}
          dispatch={dispatch}
          style={{
            top: 60,
            left: 272,
          }}
          onClose={closePopover}
          excludeRef={railRef}
        />
      )}
    </div>
  );
}
