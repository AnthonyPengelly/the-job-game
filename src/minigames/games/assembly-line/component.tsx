import { useState } from 'react';
import { Eye, Hand } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { AssemblyLineParams } from './generate';
import { resolveDeal, singularRank } from './deal';
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
  dial,
  committed,
  onResolve,
}: MiniGameProps<AssemblyLineParams>): JSX.Element {
  const [state, setState] = useState<AssemblyLineState>(() => initState(committed.length));
  const [dealt, setDealt] = useState(false);

  const deal = resolveDeal(params.rankOrder, params.decoysPerPlayer, committed.length);

  const fillPct = Math.min((state.setsCompleted / state.targetSets) * 100, 100);
  const allDone = state.setsCompleted >= state.targetSets;

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleSetComplete() {
    setState(s => ({ ...s, setsCompleted: Math.min(s.setsCompleted + 1, s.targetSets) }));
  }

  function handleUndo() {
    setState(s => ({ ...s, setsCompleted: Math.max(0, s.setsCompleted - 1) }));
  }

  function handleBoost(hook: BoostHook<AssemblyLineState, AssemblyLineParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state));
  }

  const badgeClass = allDone
    ? 'mg-status-badge mg-status-badge--clean'
    : state.timerExpired
      ? 'mg-status-badge mg-status-badge--botched'
      : 'mg-status-badge mg-status-badge--active';
  const badgeLabel = !dealt
    ? 'Setup'
    : allDone ? 'DONE' : state.timerExpired ? 'TIME' : state.tipOffUsed ? 'Active · tip-off' : 'Trading';

  return (
    <div data-testid="assembly-line">
      <StatusZone>
        <span className={badgeClass} data-testid="al-mode-badge">
          {badgeLabel}
        </span>
        {dealt && (
          <Timer
            seconds={params.timerSeconds}
            running={!state.timerExpired && !allDone}
            onExpire={handleTimerExpire}
            audible
          />
        )}
        <div className="mg-progress-bar" data-testid="al-progress">
          <div className="mg-progress-bar__label">
            <span data-testid="al-sets-completed">
              Sets complete · {state.setsCompleted} / {state.targetSets}
            </span>
          </div>
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
        <span className="mg-dial-inline" data-testid="al-dial">
          Dial {dial.level.toFixed(1)}
        </span>
        <span className="mg-dial-inline" data-testid="al-hand-size">
          {deal.handSize} cards each
        </span>
      </StatusZone>

      <ChallengeZone>
        {!dealt ? (
          <div className="mg-setup-panel" data-testid="al-setup">
            <div className="mg-setup-panel__title">
              <Hand size={16} />
              Build the deck — GM only
            </div>
            <ol className="mg-setup-panel__steps">
              <li>
                Pull <strong>all four of each: {deal.setRanks.join(' · ')}</strong>
                {' '}({deal.setRanks.length * 4} cards). Don't say which ranks.
              </li>
              {deal.decoyRanks.length > 0 && (
                <li>
                  Add decoys — <strong>one {deal.decoyRanks.map(singularRank).join(', one ')}</strong>.
                </li>
              )}
              <li>Shuffle them together and deal <strong>{deal.handSize} cards to each player</strong>.</li>
            </ol>
            <p className="mg-setup-panel__rule">
              The table trades simultaneously — shout what you want, take what you need.
              Each player collects <strong>four of a kind</strong>. Talk is allowed; the clock is the enemy.
              {deal.decoyRanks.length > 0 ? ' Some cards are junk — Tip-Off names the real ranks.' : ''}
            </p>
            <button
              type="button"
              className="mg-call-outcome-btn"
              data-testid="al-dealt"
              onClick={() => setDealt(true)}
            >
              Hands dealt — start the clock
            </button>
          </div>
        ) : (
          <>
            {state.tipOffUsed && (
              <div className="al-type-strip" data-testid="al-types-revealed">
                <Eye size={14} className="al-type-strip-icon" />
                <span className="al-type-strip-label">Ranks in play</span>
                <span className="al-type-strip-values">
                  {deal.setRanks.join(' · ')}
                </span>
                <span className="al-type-strip-hint">
                  no others — don't chase them
                </span>
              </div>
            )}

            <div className="al-hero-row" data-testid="al-hero-row">
              <div className="al-hero-block">
                <div className="mg-hero-num" data-testid="al-sets-num">{state.setsCompleted}</div>
                <div className="mg-hero-sub">sets complete</div>
              </div>
              <div className="al-tally-controls">
                <button
                  className="mg-tbtn"
                  data-testid="al-tally-increment"
                  onClick={handleSetComplete}
                  disabled={allDone}
                >
                  <span className="mg-tl">+1</span>
                  <span className="mg-ts">Set done</span>
                </button>
                <button
                  className="mg-tbtn mg-tbtn--ghost"
                  data-testid="al-tally-undo"
                  onClick={handleUndo}
                  disabled={state.setsCompleted === 0}
                >
                  Undo
                </button>
              </div>
            </div>
          </>
        )}
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
