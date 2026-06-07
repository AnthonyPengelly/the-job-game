import { useState } from 'react';
import { Triangle, CheckCircle, XCircle, Users } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { SteadyHandsParams } from './generate';
import type { SteadyHandsState } from './judge';
import { judge, extraHandsBoost, steadyBreathBoost } from './judge';

const EXTRA_HANDS_SECONDS = 10;

function initState(): SteadyHandsState {
  return {
    timerExpired: false,
    extraHandsUsed: false,
    extraHandsActive: false,
    steadyBreathUsed: false,
    wobbleForgiven: false,
  };
}

export function SteadyHandsComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<SteadyHandsParams>): JSX.Element {
  const [state, setState] = useState<SteadyHandsState>(initState);

  let badgeClass = 'mg-status-badge mg-status-badge--active';
  let badgeIcon: React.ReactNode = <Triangle size={14} />;
  let badgeLabel = 'Building';
  if (state.timerExpired) {
    badgeClass = 'mg-status-badge mg-status-badge--botched';
    badgeIcon = <XCircle size={14} />;
    badgeLabel = 'TIME';
  } else if (state.wobbleForgiven) {
    badgeClass = 'mg-status-badge mg-status-badge--complication';
    badgeIcon = <CheckCircle size={14} />;
    badgeLabel = 'WOBBLE FORGIVEN';
  }

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleExtraHandsExpire() {
    setState(s => ({ ...s, extraHandsActive: false }));
  }

  function handleBoost(hook: BoostHook<SteadyHandsState, SteadyHandsParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state));
  }

  return (
    <div data-testid="steady-hands">
      <StatusZone>
        <span className={badgeClass}>
          {badgeIcon}
          <span>{badgeLabel}</span>
        </span>
        <span data-testid="sh-target-height">Target: {params.targetHeight} blocks</span>
        <Timer
          seconds={params.timerSeconds}
          running={!state.timerExpired}
          onExpire={handleTimerExpire}
          audible
        />
        {state.timerExpired && (
          <span data-testid="sh-timer-expired">Time is up!</span>
        )}
      </StatusZone>

      <ChallengeZone>
        <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-data)', color: 'var(--fg)' }}>
          <Triangle size={24} style={{ display: 'inline', marginRight: 8 }} />
          <span data-testid="sh-height-hero">{params.targetHeight}</span>
          <span style={{ fontSize: '1rem', marginLeft: 8, color: 'var(--fg-muted)' }}>blocks</span>
        </div>

        {state.wobbleForgiven && (
          <div data-testid="sh-wobble-forgiven" className="mg-status-badge mg-status-badge--complication" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
            Steady Breath — wobble forgiven
          </div>
        )}

        {state.extraHandsActive && (
          <div data-testid="sh-extra-hands" style={{
            marginTop: '1rem',
            padding: '0.75rem',
            border: '2px solid var(--accent, #1fd06e)',
            borderRadius: 'var(--radius-md, 7px)',
            background: 'var(--c-green-900, #0a2c1c)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <Users size={18} style={{ color: 'var(--c-green-200, #b6f7d2)' }} />
            <span style={{ color: 'var(--c-green-200, #b6f7d2)', fontWeight: 700 }}>
              All hands on deck!
            </span>
            <Timer
              seconds={EXTRA_HANDS_SECONDS}
              running={state.extraHandsActive}
              onExpire={handleExtraHandsExpire}
            />
          </div>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<SteadyHandsState, SteadyHandsParams>
            hook={extraHandsBoost}
            committed={committed}
            onFire={handleBoost}
          />
        </div>
        <div className="mg-boost-slot">
          <BoostButton<SteadyHandsState, SteadyHandsParams>
            hook={steadyBreathBoost}
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
