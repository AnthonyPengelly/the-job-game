import { useState } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
import type { AssemblyLineParams } from './generate';
import { judge, quickHandsBoost, tipOffBoost } from './judge';
import type { AssemblyLineState } from './judge';

function initState(targetSets: number): AssemblyLineState {
  return {
    timerExpired: false,
    setsCompleted: 0,
    targetSets,
    quickHandsUsed: false,
    tipOffUsed: false,
  };
}

export function AssemblyLineComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<AssemblyLineParams>): JSX.Element {
  const [state, setState] = useState<AssemblyLineState>(() => initState(committed.length));

  const suggested = judge(state);

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleSetComplete() {
    setState(s => ({ ...s, setsCompleted: Math.min(s.setsCompleted + 1, s.targetSets) }));
  }

  function handleBoost(hook: BoostHook<AssemblyLineState, AssemblyLineParams>) {
    setState(s => hook.apply(s, params));
  }

  return (
    <div data-testid="assembly-line">
      <div data-testid="al-info">
        <span data-testid="al-hand-size">Hand size: {params.handSize} cards</span>
        <span data-testid="al-type-count"> | {params.setTypesInPlay.length} set types in play</span>
      </div>

      <div data-testid="al-instructions">
        Pit-style — everyone trades simultaneously (shout it out!)
      </div>

      {state.tipOffUsed && (
        <div data-testid="al-types-revealed">
          Types in play: {params.setTypesInPlay.join(', ')}
        </div>
      )}

      {state.quickHandsUsed && (
        <div data-testid="al-quick-hands-active">
          Quick Hands active — 2-for-1 trade!
        </div>
      )}

      <Timer
        seconds={params.timerSeconds}
        running={!state.timerExpired}
        onExpire={handleTimerExpire}
        audible
      />

      <div data-testid="al-tally">
        <span data-testid="al-sets-completed">
          Sets complete: {state.setsCompleted}/{state.targetSets}
        </span>
        <button
          data-testid="al-tally-increment"
          onClick={handleSetComplete}
          disabled={state.setsCompleted >= state.targetSets}
        >
          + Set complete
        </button>
      </div>

      <div data-testid="boosts">
        <BoostButton<AssemblyLineState, AssemblyLineParams>
          hook={quickHandsBoost}
          committed={committed}
          onFire={handleBoost}
        />
        <BoostButton<AssemblyLineState, AssemblyLineParams>
          hook={tipOffBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
