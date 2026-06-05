import { useState } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
import type { AssemblyLineNegotiatedParams } from './generate';
import { judge, quickHandsBoost, tipOffBoost } from './judge';
import type { AssemblyLineNegotiatedState } from './judge';

function initState(targetSets: number): AssemblyLineNegotiatedState {
  return {
    timerExpired: false,
    setsCompleted: 0,
    targetSets,
    quickHandsUsed: false,
    tipOffUsed: false,
  };
}

export function AssemblyLineNegotiatedComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<AssemblyLineNegotiatedParams>): JSX.Element {
  const [state, setState] = useState<AssemblyLineNegotiatedState>(() => initState(committed.length));

  const suggested = judge(state);

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleSetComplete() {
    setState(s => ({ ...s, setsCompleted: Math.min(s.setsCompleted + 1, s.targetSets) }));
  }

  function handleBoost(hook: BoostHook<AssemblyLineNegotiatedState, AssemblyLineNegotiatedParams>) {
    setState(s => hook.apply(s, params));
  }

  return (
    <div data-testid="assembly-line-negotiated">
      <div data-testid="aln-info">
        <span data-testid="aln-hand-size">Hand size: {params.handSize} cards</span>
        <span data-testid="aln-type-count"> | {params.setTypesInPlay.length} set types in play</span>
      </div>

      <div data-testid="aln-instructions">
        Negotiated swap — take turns offering one card at a time.
      </div>

      {state.tipOffUsed && (
        <div data-testid="aln-types-revealed">
          Types in play: {params.setTypesInPlay.join(', ')}
        </div>
      )}

      {state.quickHandsUsed && (
        <div data-testid="aln-quick-hands-active">
          Quick Hands active — 2-for-1 trade!
        </div>
      )}

      <Timer
        seconds={params.timerSeconds}
        running={!state.timerExpired}
        onExpire={handleTimerExpire}
        audible
      />

      <div data-testid="aln-tally">
        <span data-testid="aln-sets-completed">
          Sets complete: {state.setsCompleted}/{state.targetSets}
        </span>
        <button
          data-testid="aln-tally-increment"
          onClick={handleSetComplete}
          disabled={state.setsCompleted >= state.targetSets}
        >
          + Set complete
        </button>
      </div>

      <div data-testid="boosts">
        <BoostButton<AssemblyLineNegotiatedState, AssemblyLineNegotiatedParams>
          hook={quickHandsBoost}
          committed={committed}
          onFire={handleBoost}
        />
        <BoostButton<AssemblyLineNegotiatedState, AssemblyLineNegotiatedParams>
          hook={tipOffBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
