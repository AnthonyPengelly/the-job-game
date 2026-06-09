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
  dial,
  committed,
  onResolve,
}: MiniGameProps<CategoriesParams>): JSX.Element {
  const [state, setState] = useState<CategoriesState>(initState);

  const activeCategory = state.skipped ? params.skipCategory : params.category;
  const targetMet = state.tally >= params.targetCount;
  const fillPct = Math.min((state.tally / params.targetCount) * 100, 100);
  const remaining = Math.max(0, params.targetCount - state.tally);

  function handleTally() {
    setState(s => ({ ...s, tally: s.tally + 1 }));
  }

  function handleUndoTally() {
    setState(s => ({ ...s, tally: Math.max(0, s.tally - 1) }));
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

  const hintText = state.tally >= params.targetCount
    ? 'Target reached — clean pass!'
    : `${remaining} more before the buzzer for a clean pass`;

  return (
    <div data-testid="categories">
      <StatusZone>
        <span
          className={`mg-status-badge${targetMet ? ' mg-status-badge--clean' : state.timerExpired ? ' mg-status-badge--botched' : ' mg-status-badge--active'}`}
          data-testid="categories-mode-badge"
        >
          {targetMet ? 'DONE' : state.timerExpired ? 'BUZZER' : 'Active'}
        </span>
        <Timer
          seconds={params.timerSeconds}
          running={!state.timerExpired && !targetMet}
          onExpire={handleTimerExpire}
          audible
        />
        <div className="mg-progress-bar" data-testid="categories-progress">
          <div className="mg-progress-bar__label">
            <span>
              Valid answers · {state.tally} / <span data-testid="categories-target">{params.targetCount}</span>
            </span>
          </div>
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${fillPct}%` }}
              data-testid="categories-progress-fill"
            />
          </div>
        </div>
        <span className="mg-dial-inline" data-testid="categories-dial">
          Dial {dial.level.toFixed(1)}
        </span>
      </StatusZone>

      <ChallengeZone>
        <div
          className="mg-hero-word"
          data-testid="categories-category"
        >
          {activeCategory}
        </div>

        <div className="mg-tally" data-testid="categories-tally">
          <span className="mg-tcount" data-testid="tally-count">{state.tally}</span>
          <div className="mg-tally-controls">
            <button
              className="mg-tbtn"
              data-testid="tally-increment"
              onClick={handleTally}
            >
              <span className="mg-tl">+1</span>
              <span className="mg-ts">Valid answer</span>
            </button>
            <button
              className="mg-tbtn mg-tbtn--ghost"
              data-testid="tally-undo"
              onClick={handleUndoTally}
              disabled={state.tally === 0}
            >
              Undo
            </button>
          </div>
        </div>

        <div className="mg-hero-sub" data-testid="categories-hint">
          {hintText}
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
