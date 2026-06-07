import { useState } from 'react';
import { Eye, Search } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { CardSpread } from '@/minigames/primitives/CardSpread';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
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

  const isIdentifyPhase = state.studyTimerExpired;

  function handleStudyExpire() {
    setState(s => ({ ...s, studyTimerExpired: true }));
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

  const phaseBadgeClass = isIdentifyPhase
    ? (state.hunchActive ? 'mg-status-badge mg-status-badge--complication' : 'mg-status-badge mg-status-badge--active')
    : 'mg-status-badge mg-status-badge--active';

  return (
    <div data-testid="the-once-over">
      <StatusZone>
        <span className={phaseBadgeClass}>
          {isIdentifyPhase ? <Search size={14} /> : <Eye size={14} />}
          <span data-testid="onceover-phase">{isIdentifyPhase ? 'Identify' : 'Study'}</span>
        </span>
        <span data-testid="onceover-change-count">Changes: {params.changeCount}</span>
        {state.hunchActive && (
          <span data-testid="hunch-active">GM: give a verbal clue now</span>
        )}
      </StatusZone>

      <ChallengeZone>
        {!isIdentifyPhase && (
          <Timer
            seconds={params.studySeconds}
            running={!isIdentifyPhase}
            onExpire={handleStudyExpire}
            audible
          />
        )}

        <CardSpread
          cards={displayCards}
          layout="row"
          faceDown={[]}
          {...(isIdentifyPhase && { onTap: handleCardTap })}
        />

        {isIdentifyPhase && (
          <div data-testid="onceover-flagged">
            Flagged: {state.flaggedCardIds.length === 0
              ? 'none'
              : state.flaggedCardIds.map(id => {
                  const card = params.modifiedCards.find(c => c.id === id);
                  return card?.label ?? id;
                }).join(', ')}
          </div>
        )}

        {isIdentifyPhase && (
          <div data-testid="onceover-flagged-cards">
            {params.modifiedCards.map(c => (
              <span
                key={c.id}
                data-testid={`flagged-indicator-${c.id}`}
                style={{ fontWeight: flaggedSet.has(c.id) ? 'bold' : 'normal' }}
              >
                {flaggedSet.has(c.id) ? `[${c.label}]` : c.label}
              </span>
            ))}
          </div>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<OnceOverState, OnceOverParams>
            hook={hunchBoost}
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
