import { useState } from 'react';
import { Eye, EyeOff, Hand, Search } from 'lucide-react';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import type { OnceOverParams, PositionChange } from './generate';
import { judge, hunchBoost } from './judge';
import type { OnceOverState } from './judge';

type Phase = 'setup' | 'study' | 'change' | 'identify';

function initState(): OnceOverState {
  return {
    hits: 0,
    misses: 0,
    studyTimerExpired: false,
    stealthBoostUsed: false,
    hunchActive: false,
  };
}

function changeText(change: PositionChange): string {
  if (change.type === 'swap') {
    return `Swap the cards at positions ${change.positions[0]} and ${change.positions[1]}.`;
  }
  return `Replace the card at position ${change.positions[0]} with the top card of the deck.`;
}

export function TheOnceOverComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<OnceOverParams>): JSX.Element {
  const [state, setState] = useState<OnceOverState>(initState);
  const [phase, setPhase] = useState<Phase>('setup');

  function handleStudyExpire() {
    setState(s => ({ ...s, studyTimerExpired: true }));
    setPhase('change');
  }

  function handleHit() {
    setState(s =>
      s.hits >= params.changeCount ? s : { ...s, hits: s.hits + 1 },
    );
  }

  function handleMiss() {
    setState(s => ({ ...s, misses: s.misses + 1 }));
  }

  function handleBoost(hook: BoostHook<OnceOverState, OnceOverParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  const phaseBadge: Record<Phase, { icon: JSX.Element; label: string }> = {
    setup: { icon: <Hand size={14} />, label: 'Setup' },
    study: { icon: <Eye size={14} />, label: 'Study' },
    change: { icon: <EyeOff size={14} />, label: 'Make the changes' },
    identify: { icon: <Search size={14} />, label: 'Identify' },
  };

  return (
    <div data-testid="the-once-over">
      <StatusZone>
        <span className="mg-status-badge mg-status-badge--active" data-testid="oo-phase">
          {phaseBadge[phase].icon}
          {phaseBadge[phase].label}
        </span>
        <span className="mg-dial-inline" data-testid="oo-change-count">
          {params.changeCount} change{params.changeCount !== 1 ? 's' : ''}
        </span>
        {phase === 'identify' && (
          <span className="mg-dial-inline" data-testid="oo-score">
            Spotted · {state.hits} / {params.changeCount}
            {state.misses > 0 ? ` · ${state.misses} wrong` : ''}
          </span>
        )}
      </StatusZone>

      <ChallengeZone>
        {phase === 'setup' && (
          <div className="mg-setup-panel" data-testid="oo-setup">
            <div className="mg-setup-panel__title">
              <Hand size={16} />
              Set up the table
            </div>
            <ol className="mg-setup-panel__steps">
              <li>Shuffle the pack.</li>
              <li>Deal <strong>{params.cardCount} cards face-up in a row</strong> where the crew can see them.</li>
              <li>Keep the rest of the deck as a face-down draw pile — you may need it.</li>
            </ol>
            <p className="mg-setup-panel__rule">
              The crew studies the row while the clock runs. Then they look away while you make
              the changes — only you will see the instructions.
            </p>
            <button
              type="button"
              className="mg-call-outcome-btn"
              data-testid="oo-start-study"
              onClick={() => setPhase('study')}
            >
              Row dealt — start the study clock
            </button>
          </div>
        )}

        {phase === 'study' && (
          <div data-testid="study-phase">
            <Timer
              seconds={params.studySeconds}
              running
              onExpire={handleStudyExpire}
              audible
            />
            <div className="ctb-subtext">
              The crew studies the row — order, values, suits. Changes come when the clock ends.
            </div>
          </div>
        )}

        {phase === 'change' && (
          <div className="mg-setup-panel" data-testid="oo-change-instructions">
            <div className="mg-setup-panel__title">
              <EyeOff size={16} />
              Crew looks away — GM only
            </div>
            <p className="mg-setup-panel__rule">
              Hide the row (box lid, menu, or eyes shut) and apply, in order — positions count
              from <strong>your left</strong>:
            </p>
            <ol className="mg-setup-panel__steps" data-testid="oo-change-list">
              {params.changes.map((change, i) => (
                <li key={i} data-testid={`oo-change-${i}`}>{changeText(change)}</li>
              ))}
            </ol>
            <button
              type="button"
              className="mg-call-outcome-btn"
              data-testid="oo-reveal"
              onClick={() => setPhase('identify')}
            >
              Changes made — reveal the row
            </button>
          </div>
        )}

        {phase === 'identify' && (
          <div data-testid="identify-phase">
            <div className="ctb-subtext">
              The crew calls out what changed. Mark each callout against your list:
            </div>
            <ul className="mg-setup-panel__steps" style={{ listStyle: 'none', paddingLeft: 0, marginTop: '0.5rem' }}>
              {params.changes.map((change, i) => (
                <li key={i} className="mg-dial-inline" data-testid={`oo-answer-${i}`}>
                  {changeText(change)}
                </li>
              ))}
            </ul>
            <div className="mg-record-controls" data-testid="oo-record-controls">
              <button
                type="button"
                className="mg-tbtn"
                data-testid="oo-hit"
                onClick={handleHit}
                disabled={state.hits >= params.changeCount}
              >
                <span className="mg-tl">✓</span>
                <span className="mg-ts">Spotted</span>
              </button>
              <button
                type="button"
                className="mg-tbtn mg-tbtn--danger"
                data-testid="oo-miss"
                onClick={handleMiss}
              >
                <span className="mg-tl">✗</span>
                <span className="mg-ts">Wrong call</span>
              </button>
            </div>
          </div>
        )}

        {state.hunchActive && phase === 'identify' && (
          <div className="ctb-subtext" data-testid="oo-hunch" style={{ marginTop: '0.75rem' }}>
            Hunch fired — give the crew one live verbal clue.
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
        {phase === 'identify' && (
          <button
            type="button"
            className="mg-call-outcome-btn"
            data-testid="btn-call-outcome"
            onClick={handleCallOutcome}
          >
            Call Outcome
          </button>
        )}
      </RefereeZone>
    </div>
  );
}
