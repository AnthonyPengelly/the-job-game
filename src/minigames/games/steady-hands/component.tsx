import { useState } from 'react';
import { Triangle, XCircle, Zap } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { SteadyHandsParams } from './generate';
import type { SteadyHandsState } from './judge';
import { judge, extraHandsBoost } from './judge';

const EXTRA_HANDS_SECONDS = 10;

function initState(): SteadyHandsState {
  return {
    timerExpired: false,
    extraHandsUsed: false,
    extraHandsActive: false,
    currentHeight: 0,
  };
}

export function SteadyHandsComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<SteadyHandsParams>): JSX.Element {
  const [state, setState] = useState<SteadyHandsState>(initState);
  const [burstSeconds, setBurstSeconds] = useState(EXTRA_HANDS_SECONDS);

  const fillPct = Math.min((state.currentHeight / params.targetHeight) * 100, 100);
  const remaining = Math.max(0, params.targetHeight - state.currentHeight);

  let badgeClass = 'mg-status-badge mg-status-badge--active';
  let badgeIcon: React.ReactNode = <Triangle size={14} />;
  let badgeLabel = 'Building';
  if (state.timerExpired) {
    badgeClass = 'mg-status-badge mg-status-badge--botched';
    badgeIcon = <XCircle size={14} />;
    badgeLabel = 'TIME';
  }

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleExtraHandsExpire() {
    setState(s => ({ ...s, extraHandsActive: false }));
  }

  function handleBoost(hook: BoostHook<SteadyHandsState, SteadyHandsParams>) {
    setState(s => hook.apply(s, params));
    setBurstSeconds(EXTRA_HANDS_SECONDS);
  }

  function handleHeightUp() {
    setState(s => ({ ...s, currentHeight: Math.min(s.currentHeight + 1, params.targetHeight) }));
  }

  function handleHeightDown() {
    setState(s => ({ ...s, currentHeight: Math.max(0, s.currentHeight - 1) }));
  }

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  // Build tower: solid bricks up to currentHeight, dashed bricks for remaining
  const totalBricks = params.targetHeight;
  const solidBricks = state.currentHeight;
  const targetBricks = totalBricks - solidBricks;

  return (
    <div data-testid="steady-hands">
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
        <div className="mg-progress-bar" data-testid="sh-progress">
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${fillPct}%` }}
              data-testid="sh-progress-fill"
            />
          </div>
          <span className="mg-progress-bar__label" data-testid="sh-progress-label">
            Height built · <span data-testid="sh-target-height">{state.currentHeight}&nbsp;/&nbsp;{params.targetHeight}</span> tiers
          </span>
        </div>
      </StatusZone>

      <ChallengeZone>
        <div className="sh-tower-area">
          <div className="sh-tower" data-testid="sh-tower" aria-label={`Tower: ${solidBricks} of ${totalBricks} tiers`}>
            {Array.from({ length: targetBricks }).map((_, i) => (
              <div key={`t-${i}`} className="sh-brick sh-brick--target" />
            ))}
            {Array.from({ length: solidBricks }).map((_, i) => (
              <div key={`b-${i}`} className="sh-brick" />
            ))}
          </div>

          <div className="sh-hero">
            <div className="sh-hero-num" data-testid="sh-height-hero">
              {state.currentHeight}
              <small style={{ fontSize: '1.5rem', color: 'var(--fg-faint, #506a62)' }}>/{params.targetHeight}</small>
            </div>
            <div className="sh-hero-sub">
              {remaining > 0
                ? `${remaining} tier${remaining !== 1 ? 's' : ''} to go`
                : 'Target reached!'}
            </div>
            <div className="sh-height-controls" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="mg-tbtn"
                data-testid="sh-height-up"
                onClick={handleHeightUp}
                disabled={state.currentHeight >= params.targetHeight}
              >
                <span className="mg-tl">+1</span>
                <span className="mg-ts">Tier built</span>
              </button>
              <button
                type="button"
                className="mg-tbtn mg-tbtn--ghost"
                data-testid="sh-height-down"
                onClick={handleHeightDown}
                disabled={state.currentHeight === 0}
              >
                Undo
              </button>
            </div>
          </div>
        </div>

        {state.extraHandsActive && (
          <div data-testid="sh-extra-hands" className="sh-burst" style={{ marginTop: '1rem' }}>
            <Zap size={17} style={{ color: 'var(--caution, #f7b84b)', flexShrink: 0 }} />
            <div>
              <div className="sh-burst-label">Extra Hands · burst</div>
              <div className="sh-burst-timer">
                <Timer
                  seconds={burstSeconds}
                  running={state.extraHandsActive}
                  onExpire={handleExtraHandsExpire}
                />
              </div>
            </div>
            <span className="sh-hero-sub" style={{ marginTop: 0, marginLeft: 'auto' }}>
              Secondary clock — separate from build timer
            </span>
          </div>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<SteadyHandsState, SteadyHandsParams>
            hook={extraHandsBoost}
            gameLanes={['physical', 'stealth']}
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
