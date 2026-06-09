import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { PlayerId } from '@/engine';

export type CrewRailMode = 'idle' | 'commit' | 'attempter';

export interface CrewRailModeContextValue {
  mode: CrewRailMode;
  /** Crew members selected for commit (obstacle). Non-empty only in 'commit' mode. */
  committed: ReadonlySet<PlayerId>;
  /** Crew member selected as attempter (scenario). Non-null only in 'attempter' mode. */
  selectedAttempter: PlayerId | null;
  minCommit: number;
  maxCommit: number;
  /** Activate multi-select commit mode. Resets any prior selection. */
  activateCommit: (min: number, max: number) => void;
  /**
   * Activate full-team commit mode: pre-populates committed with all given IDs,
   * sets min=max=ids.length. Used for full-team games where no crew-select is shown.
   */
  activateFullTeam: (ids: readonly PlayerId[]) => void;
  /** Activate single-select attempter mode. Resets any prior selection. */
  activateAttempter: () => void;
  /** Return to idle mode and clear all selections. */
  deactivate: () => void;
  /** Toggle a player in/out of the committed set (commit mode only). */
  toggleCommit: (id: PlayerId) => void;
  /** Pick a player as the attempter (attempter mode only). */
  pickAttempter: (id: PlayerId) => void;
}

export const CrewRailModeContext = createContext<CrewRailModeContextValue | null>(null);

export function useCrewRailMode(): CrewRailModeContextValue {
  const ctx = useContext(CrewRailModeContext);
  if (ctx === null) {
    throw new Error('useCrewRailMode must be used inside a CrewRailModeProvider');
  }
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface CrewRailModeProviderProps {
  children: ReactNode;
}

/**
 * Provides crew rail selection state to the cockpit tree.
 *
 * Stage screens consume `useCrewRailMode()` to activate commit / attempter
 * modes and read back the selected crew IDs before dispatching engine events.
 * CrewRail consumes it to render the correct selection highlights.
 */
export function CrewRailModeProvider({ children }: CrewRailModeProviderProps) {
  const [mode, setMode] = useState<CrewRailMode>('idle');
  const [committed, setCommitted] = useState<Set<PlayerId>>(new Set());
  const [selectedAttempter, setSelectedAttempter] = useState<PlayerId | null>(null);
  const [minCommit, setMinCommit] = useState(1);
  const [maxCommit, setMaxCommit] = useState(1);

  const activateCommit = useCallback((min: number, max: number) => {
    setMode('commit');
    setCommitted(new Set());
    setSelectedAttempter(null);
    setMinCommit(min);
    setMaxCommit(max);
  }, []);

  const activateFullTeam = useCallback((ids: readonly PlayerId[]) => {
    setMode('commit');
    setCommitted(new Set(ids));
    setSelectedAttempter(null);
    setMinCommit(ids.length);
    setMaxCommit(ids.length);
  }, []);

  const activateAttempter = useCallback(() => {
    setMode('attempter');
    setCommitted(new Set());
    setSelectedAttempter(null);
  }, []);

  const deactivate = useCallback(() => {
    setMode('idle');
    setCommitted(new Set());
    setSelectedAttempter(null);
  }, []);

  const toggleCommit = useCallback((id: PlayerId) => {
    setCommitted(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxCommit) {
        next.add(id);
      }
      return next;
    });
  }, [maxCommit]);

  const pickAttempter = useCallback((id: PlayerId) => {
    setSelectedAttempter(id);
  }, []);

  const value: CrewRailModeContextValue = {
    mode,
    committed,
    selectedAttempter,
    minCommit,
    maxCommit,
    activateCommit,
    activateFullTeam,
    activateAttempter,
    deactivate,
    toggleCommit,
    pickAttempter,
  };

  return (
    <CrewRailModeContext.Provider value={value}>
      {children}
    </CrewRailModeContext.Provider>
  );
}
