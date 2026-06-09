import { useState } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
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
  const fillPct = Math.min((state.tally / params.targetCount) * 100, 100);

  function handleTally() {
    setState(s => ({ ...s, tally: s.tally + 1 }));
  }

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleBoost(hook: BoostHook<CategoriesState, CategoriesParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  return (
    <div data-testid="categories">
      <StatusZone>
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
          <span className="mg-progress-bar__label">
            {state.tally} / {params.targetCount}
          </span>
        </div>
      </StatusZone>

      <ChallengeZone>
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
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<CategoriesState, CategoriesParams>
            hook={skipBoost}
            gameLanes={['charm']}
            committed={committed}
            onFire={handleBoost}
          />
        </div>
        <button
          type="button"
          data-testid="btn-call-outcome"
          className="mg-call-outcome-btn"
          onClick={handleCallOutcome}
        >
          Call Outcome
        </button>
      </RefereeZone>
    </div>
  );
}
