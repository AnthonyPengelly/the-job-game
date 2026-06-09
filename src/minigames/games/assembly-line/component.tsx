import { useState } from 'react';
import { CheckCircle, XCircle, Package } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { AssemblyLineParams } from './generate';
import { judge, tipOffBoost } from './judge';
import type { AssemblyLineState } from './judge';

function initState(targetSets: number): AssemblyLineState {
  return {
    timerExpired: false,
    setsCompleted: 0,
    targetSets,
    tipOffUsed: false,
  };
}

export function AssemblyLineComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<AssemblyLineParams>): JSX.Element {
  const [state, setState] = useState<AssemblyLineState>(() => initState(committed.length));

  const fillPct = Math.min((state.setsCompleted / state.targetSets) * 100, 100);
  const allDone = state.setsCompleted >= state.targetSets;

  let badgeClass = 'mg-status-badge mg-status-badge--active';
  let badgeIcon: React.ReactNode = <Package size={14} />;
  let badgeLabel = 'Trading';
  if (allDone && !state.timerExpired) {
    badgeClass = 'mg-status-badge mg-status-badge--clean';
    badgeIcon = <CheckCircle size={14} />;
    badgeLabel = 'DONE';
  } else if (state.timerExpired && !allDone) {
    badgeClass = 'mg-status-badge mg-status-badge--botched';
    badgeIcon = <XCircle size={14} />;
    badgeLabel = 'TIME';
  }

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleSetComplete() {
    setState(s => ({ ...s, setsCompleted: Math.min(s.setsCompleted + 1, s.targetSets) }));
  }

  function handleBoost(hook: BoostHook<AssemblyLineState, AssemblyLineParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state));
  }

  return (
    <div data-testid="assembly-line">
      <StatusZone>
        <span className={badgeClass}>
          {badgeIcon}
          <span>{badgeLabel}</span>
        </span>
        <Timer
          seconds={params.timerSeconds}
          running={!state.timerExpired}
          onExpire={handleTimerExpire}
          audible
        />
        <div className="mg-progress-bar">
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <span className="mg-progress-bar__label" data-testid="al-sets-completed">
            {state.setsCompleted} / {state.targetSets} sets
          </span>
        </div>
      </StatusZone>

      <ChallengeZone>
        <div data-testid="al-info">
          <span data-testid="al-hand-size">Hand size: {params.handSize} cards</span>
          <span data-testid="al-type-count"> | {params.setTypesInPlay.length} types in play</span>
        </div>

        <div data-testid="al-instructions" style={{ color: 'var(--fg-muted, #a4b2ad)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Pit-style — everyone trades simultaneously (shout it out!)
        </div>

        {state.tipOffUsed && (
          <div data-testid="al-types-revealed" className="mg-status-badge mg-status-badge--complication" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
            Types: {params.setTypesInPlay.join(', ')}
          </div>
        )}

        <div data-testid="al-tally" style={{ marginTop: '1rem' }}>
          <button
            data-testid="al-tally-increment"
            className="mg-call-outcome-btn"
            onClick={handleSetComplete}
            disabled={state.setsCompleted >= state.targetSets}
          >
            + Set complete
          </button>
        </div>
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<AssemblyLineState, AssemblyLineParams>
            hook={tipOffBoost}
            gameLanes={['physical', 'charm']}
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
