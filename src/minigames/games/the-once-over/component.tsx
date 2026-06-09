import { useState } from 'react';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';
import type { OnceOverParams } from './generate';
import { judge, hunchBoost } from './judge';
import type { OnceOverState } from './judge';

function initState(): OnceOverState {
  return {
    flaggedCardIds: [],
    studyTimerExpired: false,
    stealthBoostUsed: false,
    hunchActive: false,
  };
}

export function TheOnceOverComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<OnceOverParams>): JSX.Element {
  const [state, setState] = useState<OnceOverState>(initState);
  const [studyElapsedPct, setStudyElapsedPct] = useState(0);

  const isIdentifyPhase = state.studyTimerExpired;

  function handleStudyExpire() {
    setState(s => ({ ...s, studyTimerExpired: true }));
  }

  function handleStudyTick(remaining: number) {
    const elapsed = params.studySeconds - remaining;
    setStudyElapsedPct(Math.min((elapsed / params.studySeconds) * 100, 100));
  }

  function handleCardTap(id: CardId) {
    if (!isIdentifyPhase) return;
    setState(s => {
      const already = s.flaggedCardIds.includes(id);
      const newFlags = already
        ? s.flaggedCardIds.filter(f => f !== id)
        : [...s.flaggedCardIds, id];
      return { ...s, flaggedCardIds: newFlags };
    });
  }

  function handleBoost(hook: BoostHook<OnceOverState, OnceOverParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  const displayCards = isIdentifyPhase ? params.modifiedCards : params.originalCards;
  const flaggedSet = new Set(state.flaggedCardIds);
  const changedSet = new Set(params.changedCardIds);

  const progressPct = isIdentifyPhase
    ? (flaggedSet.size / Math.max(params.changeCount, 1)) * 100
    : studyElapsedPct;

  return (
    <div data-testid="the-once-over">
      <StatusZone>
        <span
          className={`mg-status-badge ${isIdentifyPhase
            ? (state.hunchActive ? 'mg-status-badge--complication' : 'mg-status-badge--active')
            : 'mg-status-badge--active'}`}
          data-testid="onceover-phase"
        >
          {isIdentifyPhase ? 'Identify' : 'Study'}
        </span>

        <div className="mg-progress-bar" aria-label={isIdentifyPhase ? 'Flagged' : 'Study window'}>
          <div className="mg-progress-bar__label">
            {isIdentifyPhase
              ? <span>Flagged · {flaggedSet.size} of {params.changeCount}</span>
              : <span>Study window · {params.studySeconds}s</span>}
          </div>
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill mg-progress-bar__fill--data"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>

        {!isIdentifyPhase && (
          <span data-testid="onceover-change-count" className="mg-status-badge mg-status-badge--active">
            {params.changeCount} change{params.changeCount !== 1 ? 's' : ''}
          </span>
        )}
      </StatusZone>

      <ChallengeZone>
        {/* Study timer (hidden in identify phase) */}
        {!isIdentifyPhase && (
          <Timer
            seconds={params.studySeconds}
            running={!isIdentifyPhase}
            onExpire={handleStudyExpire}
            onTick={handleStudyTick}
            audible
          />
        )}

        {/* Card spread — face-up in study, tappable in identify */}
        <div className="onceover-spread" data-testid="onceover-spread">
          {displayCards.map(card => {
            const isFlagged = flaggedSet.has(card.id);
            const isChanged = isIdentifyPhase && changedSet.has(card.id);

            const classes = [
              'onceover-card',
              isFlagged ? 'onceover-card--flagged' : '',
              isChanged ? 'onceover-card--changed' : '',
              isIdentifyPhase ? 'onceover-card--interactive' : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                key={card.id}
                type="button"
                className={classes}
                data-testid={`onceover-card-${card.id}`}
                data-flagged={isFlagged ? 'true' : 'false'}
                data-changed={isChanged ? 'true' : 'false'}
                onClick={() => handleCardTap(card.id)}
                disabled={!isIdentifyPhase}
              >
                {card.label}
              </button>
            );
          })}
        </div>

        {/* Sub-text */}
        {!isIdentifyPhase && (
          <div className="onceover-subtext">
            When the timer ends the spread changes — identify what moved or swapped.
          </div>
        )}
        {state.hunchActive && (
          <div className="onceover-subtext onceover-subtext--gm" data-testid="hunch-active">
            GM: give a verbal clue now
          </div>
        )}
        {isIdentifyPhase && (
          <div className="onceover-subtext onceover-subtext--gm" data-testid="onceover-gm-hint">
            GM only · changed card{params.changedCardIds.length !== 1 ? 's' : ''} have amber edge
          </div>
        )}

        {/* Flagged summary */}
        {isIdentifyPhase && (
          <div data-testid="onceover-flagged" className="onceover-subtext" style={{ marginTop: '0.75rem' }}>
            Flagged: {state.flaggedCardIds.length === 0
              ? 'none — tap a card to flag it'
              : state.flaggedCardIds.map(id => {
                  const card = params.modifiedCards.find(c => c.id === id);
                  return card?.label ?? id;
                }).join(', ')}
          </div>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<OnceOverState, OnceOverParams>
            hook={hunchBoost}
            gameLanes={['stealth']}
            committed={committed}
            onFire={handleBoost}
          />
        </div>
        <button
          type="button"
          className="mg-call-outcome-btn"
          data-testid="btn-call-outcome"
          onClick={handleCallOutcome}
        >
          Call Outcome
        </button>
      </RefereeZone>
    </div>
  );
}
