import { useState } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
import type { CategoriesParams } from './generate';
import { judge, skipBoost } from './judge';
import type { CategoriesState } from './judge';

function initState(): CategoriesState {
  return { tally: 0, timerExpired: false, charmBoostUsed: false, skipped: false };
}

export function CategoriesComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<CategoriesParams>): JSX.Element {
  const [state, setState] = useState<CategoriesState>(initState);

  const activeCategory = state.skipped ? params.skipCategory : params.category;
  const suggested = judge(state, params);

  function handleTally() {
    setState(s => ({ ...s, tally: s.tally + 1 }));
  }

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleBoost(hook: BoostHook<CategoriesState, CategoriesParams>) {
    setState(s => hook.apply(s, params));
  }

  return (
    <div data-testid="categories">
      <Timer
        seconds={params.timerSeconds}
        running={!state.timerExpired}
        onExpire={handleTimerExpire}
        audible
      />

      <div data-testid="categories-info">
        <span data-testid="categories-category">Category: {activeCategory}</span>
        <span data-testid="categories-target"> | Target: {params.targetCount}</span>
        {state.timerExpired && <span data-testid="categories-buzzer"> — BUZZER</span>}
      </div>

      <div data-testid="categories-tally">
        <span data-testid="tally-count">Count: {state.tally}</span>
        <button data-testid="tally-increment" onClick={handleTally}>
          + Answer
        </button>
      </div>

      <div data-testid="boosts">
        <BoostButton<CategoriesState, CategoriesParams>
          hook={skipBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
