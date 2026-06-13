import { useState } from 'react';
import { Eye, Hand } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import { resolveDeal, singularRank } from '@/minigames/games/assembly-line/deal';
import type { AssemblyLineNegotiatedParams } from './generate';
import { judge, tipOffBoost } from './judge';
import type { AssemblyLineNegotiatedState } from './judge';

function initState(targetSets: number): AssemblyLineNegotiatedState {
  return {
    timerExpired: false,
    setsCompleted: 0,
    targetSets,
    tipOffUsed: false,
  };
}

export function AssemblyLineNegotiatedComponent({
  params,
  dial,
  committed,
  onResolve,
}: MiniGameProps<AssemblyLineNegotiatedParams>): JSX.Element {
  const [state, setState] = useState<AssemblyLineNegotiatedState>(() => initState(committed.length));
  const [dealt, setDealt] = useState(false);

  const deal = resolveDeal(params.rankOrder, params.decoyCount, committed.length);

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

  function handleBoost(hook: BoostHook<AssemblyLineNegotiatedState, AssemblyLineNegotiatedParams>) {
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
    : allDone ? 'DONE' : state.timerExpired ? 'TIME' : state.tipOffUsed ? 'Active · tip-off' : 'Passing';

  return (
    <div data-testid="assembly-line-negotiated">
      <StatusZone>
        <span className={badgeClass} data-testid="aln-mode-badge">
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
        <div className="mg-progress-bar" data-testid="aln-progress">
          <div className="mg-progress-bar__label">
            <span data-testid="aln-sets-completed">
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
        <span className="mg-dial-inline" data-testid="aln-dial">
          Dial {dial.level.toFixed(1)}
        </span>
        <span className="mg-dial-inline" data-testid="aln-hand-size">
          {deal.decoyCount} bogus · {deal.totalCards} cards
        </span>
      </StatusZone>

      <ChallengeZone>
        {!dealt ? (
          <div className="mg-setup-panel" data-testid="aln-setup">
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
                  Add <strong>{deal.decoyCount} bogus card{deal.decoyCount !== 1 ? 's' : ''}</strong> —
                  one {deal.decoyRanks.map(singularRank).join(', one ')}.
                </li>
              )}
              <li>
                Shuffle and deal <strong>four each</strong>; the {deal.decoyCount} spare
                {deal.decoyCount !== 1 ? 's' : ''} mean <strong>{deal.decoyCount} player
                {deal.decoyCount !== 1 ? 's' : ''} hold five</strong>.
              </li>
            </ol>
            <p className="mg-setup-panel__rule">
              <strong>No talking.</strong> Two-up: on a silent count you each pass <strong>one card
              at the same time</strong>, fast as you can. Lay down four of a kind to go safe — keep
              passing while you still hold a card. The round is won when <strong>both sets are
              down</strong> before the buzzer. Tip-Off names the real ranks.
            </p>
            <button
              type="button"
              className="mg-call-outcome-btn"
              data-testid="aln-dealt"
              onClick={() => setDealt(true)}
            >
              Dealt — start the clock
            </button>
          </div>
        ) : (
          <>
            {state.tipOffUsed && (
              <div className="al-type-strip" data-testid="aln-types-revealed">
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

            <div className="al-hero-row" data-testid="aln-hero-row">
              <div className="al-hero-block">
                <div className="mg-hero-num" data-testid="aln-sets-num">{state.setsCompleted}</div>
                <div className="mg-hero-sub">sets complete</div>
              </div>
              <div className="al-tally-controls">
                <button
                  className="mg-tbtn"
                  data-testid="aln-tally-increment"
                  onClick={handleSetComplete}
                  disabled={allDone}
                >
                  <span className="mg-tl">+1</span>
                  <span className="mg-ts">Set done</span>
                </button>
                <button
                  className="mg-tbtn mg-tbtn--ghost"
                  data-testid="aln-tally-undo"
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
          <BoostButton<AssemblyLineNegotiatedState, AssemblyLineNegotiatedParams>
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
