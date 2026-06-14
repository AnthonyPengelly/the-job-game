import { useState } from 'react';
import type { Outcome } from '@/engine';
import type { Lane } from '@/engine';
import type { Difficulty } from '@/minigames/contract';
import { DialReadout } from './DialReadout';
import { OutcomeJudge } from './OutcomeJudge';
import type { OutcomeConsequence } from './OutcomeJudge';
import './minigame.css';

// ── Zone primitives (used by game components in E13.5/E13.6) ─────────────────

/** Status zone: mode · timer · progress. */
export function StatusZone({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mg-status-zone" data-testid="mg-status-zone">
      {children}
    </div>
  );
}

/** Challenge zone: the hero content of the game. */
export function ChallengeZone({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mg-challenge-zone" data-testid="mg-challenge-zone">
      {children}
    </div>
  );
}

/** Referee zone: boosts · outcome. */
export function RefereeZone({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mg-referee-zone" data-testid="mg-referee-zone">
      {children}
    </div>
  );
}

// ── Boost preview (ARMED state) ───────────────────────────────────────────────

/** A boost that an available committed player can shout. */
export interface BoostPreviewEntry {
  lane: Lane;
  label: string;
  holderName: string;
}

// ── MinigameShell ─────────────────────────────────────────────────────────────

type ShellState = 'armed' | 'active' | 'resolve';

export interface MinigameShellProps {
  /** Human-readable game name shown in the ARMED briefing. */
  gameName: string;
  /** Short how-to-play text shown in the ARMED state (GM reads aloud before START). */
  instructions?: string;
  /** GM-only difficulty dial. */
  dial: Difficulty;
  /** Available boosts: committed players who hold a relevant lane power-up. */
  boostPreviews: BoostPreviewEntry[];
  /**
   * Called when the GM confirms the outcome in the RESOLVE state.
   * MinigameHost handles narration quip / dispatch from here.
   */
  onConfirm: (outcome: Outcome) => void;
  /** Per-tier consequence preview for the RESOLVE state (computed by the host). */
  consequences?: Partial<Record<Outcome, OutcomeConsequence>>;
  /**
   * Render prop: receives the `onResolve` handler to pass to the game component.
   * The game component calls `onResolve(suggestedOutcome)` when the challenge is done,
   * moving the shell to RESOLVE state. The game component is only mounted in ACTIVE.
   */
  children: (onResolve: (outcome: Outcome) => void) => React.ReactNode;
}

/**
 * Universal three-state mini-game lifecycle shell.
 *
 * ARMED  → no timer can run (game component not mounted). Shows game name,
 *          GM-only dial readout, boost-holder preview, and one big START CTA.
 * ACTIVE → game component mounted inside standard stage zones (status /
 *          challenge / referee). Timer may run.
 * RESOLVE → game called onResolve; shell shows OutcomeJudge pre-selected to
 *           the suggested outcome. Only the GM's confirm feeds onConfirm;
 *           Back returns to ACTIVE.
 *
 * (E13.5/E13.6 refactor individual game components to use StatusZone /
 *  ChallengeZone / RefereeZone and call onResolve with the judge suggestion
 *  rather than after an in-component OutcomeJudge confirm.)
 */
export function MinigameShell({
  gameName,
  instructions,
  dial,
  boostPreviews,
  onConfirm,
  consequences,
  children,
}: MinigameShellProps) {
  const [shellState, setShellState] = useState<ShellState>('armed');
  const [resolveOutcome, setResolveOutcome] = useState<Outcome>('clean');

  function handleStart() {
    setShellState('active');
  }

  function handleResolve(outcome: Outcome) {
    setResolveOutcome(outcome);
    setShellState('resolve');
  }

  function handleConfirm(outcome: Outcome) {
    onConfirm(outcome);
  }

  function handleBackToGame() {
    setShellState('active');
  }

  // ── ARMED ──────────────────────────────────────────────────────────────────
  if (shellState === 'armed') {
    return (
      <div className="mg-shell mg-armed" data-testid="mg-armed">
        <div className="mg-armed-title" data-testid="mg-game-name">
          {gameName}
        </div>

        {instructions && (
          <div className="mg-armed-brief" data-testid="mg-armed-brief">
            <div className="mg-armed-brief-label">GM — read the crew the gist, then START</div>
            <p className="mg-armed-instructions" data-testid="mg-armed-instructions">
              {instructions}
            </p>
          </div>
        )}

        <DialReadout dial={dial} />

        {boostPreviews.length > 0 && (
          <div className="mg-boost-preview" data-testid="mg-boost-preview">
            {boostPreviews.map((bp) => (
              <span
                key={`${bp.lane}-${bp.holderName}`}
                className="mg-boost-tag"
                data-testid={`mg-boost-available-${bp.lane}`}
              >
                {bp.holderName}: {bp.label}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          className="mg-start-btn"
          data-testid="btn-minigame-start"
          onClick={handleStart}
        >
          START
        </button>
      </div>
    );
  }

  // ── RESOLVE ────────────────────────────────────────────────────────────────
  if (shellState === 'resolve') {
    return (
      <div className="mg-shell mg-resolve" data-testid="mg-resolve">
        <OutcomeJudge
          suggested={resolveOutcome}
          onConfirm={handleConfirm}
          {...(consequences !== undefined && { consequences })}
        />
        <button
          type="button"
          className="mg-resolve-back"
          data-testid="btn-back-to-game"
          onClick={handleBackToGame}
        >
          Back
        </button>
      </div>
    );
  }

  // ── ACTIVE ─────────────────────────────────────────────────────────────────
  // Game components render their own StatusZone / ChallengeZone / RefereeZone.
  return (
    <div className="mg-shell mg-active" data-testid="mg-active">
      {children(handleResolve)}
    </div>
  );
}
