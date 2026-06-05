import { useState } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
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

  const suggested = judge(state);

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleExtraHandsExpire() {
    setState(s => ({ ...s, extraHandsActive: false }));
  }

  function handleBoost(hook: BoostHook<SteadyHandsState, SteadyHandsParams>) {
    setState(s => hook.apply(s, params));
  }

  return (
    <div data-testid="steady-hands">
      <div data-testid="sh-header">
        <span data-testid="sh-target-height">Target height: {params.targetHeight} blocks</span>
        {state.wobbleForgiven && (
          <span data-testid="sh-wobble-forgiven"> — Wobble forgiven (Steady Breath)</span>
        )}
        {state.timerExpired && (
          <span data-testid="sh-timer-expired"> — Time is up!</span>
        )}
      </div>

      <Timer
        seconds={params.timerSeconds}
        running={!state.timerExpired}
        onExpire={handleTimerExpire}
        audible
      />

      {state.extraHandsActive && (
        <div data-testid="sh-extra-hands">
          <span>All hands on deck!</span>
          <Timer
            seconds={EXTRA_HANDS_SECONDS}
            running={state.extraHandsActive}
            onExpire={handleExtraHandsExpire}
          />
        </div>
      )}

      <div data-testid="boosts">
        <BoostButton<SteadyHandsState, SteadyHandsParams>
          hook={extraHandsBoost}
          committed={committed}
          onFire={handleBoost}
        />
        <BoostButton<SteadyHandsState, SteadyHandsParams>
          hook={steadyBreathBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
