import { useState } from 'react';
import { Eye, Hand, RotateCcw, Siren } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { CrackTheTumblersSoloParams } from './generate';
import { judge, resetPinBoost } from './judge';
import type { CrackTheTumblersSoloState } from './judge';

function initState(): CrackTheTumblersSoloState {
  return {
    phase: 'setup',
    flipsRecorded: 0,
    alarmTripped: false,
    resetPinUsed: false,
  };
}

export function CrackTheTumblersSoloComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<CrackTheTumblersSoloParams>): JSX.Element {
  const [state, setState] = useState<CrackTheTumblersSoloState>(initState);

  const total = params.cardCount;
  const gameComplete = state.alarmTripped || state.flipsRecorded >= total;
  const recallProgressPct = total > 0 ? (state.flipsRecorded / total) * 100 : 0;
  const playerName = committed[0]?.name ?? 'the player';

  function handleStartStudy() {
    setState(s => ({ ...s, phase: 'study' }));
  }

  function handleStudyExpire() {
    setState(s => ({ ...s, phase: 'recall' }));
  }

  function handleInOrder() {
    if (gameComplete || state.phase !== 'recall') return;
    setState(s =>
      s.flipsRecorded >= total ? s : { ...s, flipsRecorded: s.flipsRecorded + 1 },
    );
  }

  function handleClash() {
    if (gameComplete || state.phase !== 'recall') return;
    setState(s => ({ ...s, alarmTripped: true }));
  }

  function handleBoost(hook: BoostHook<CrackTheTumblersSoloState, CrackTheTumblersSoloParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  return (
    <div data-testid="crack-the-tumblers-solo">
      <StatusZone>
        {state.phase === 'setup' && (
          <span className="mg-status-badge mg-status-badge--active">
            <Hand size={14} />
            <span data-testid="ctt-solo-phase">Setup</span>
          </span>
        )}
        {state.phase === 'study' && (
          <span className="mg-status-badge mg-status-badge--active">
            <Eye size={14} />
            <span data-testid="ctt-solo-phase">Study</span>
          </span>
        )}
        {state.phase === 'recall' && (
          <span className={`mg-status-badge ${state.alarmTripped ? 'mg-status-badge--botched' : 'mg-status-badge--active'}`}>
            {state.alarmTripped ? <Siren size={14} /> : <RotateCcw size={14} />}
            <span data-testid="ctt-solo-phase">Recall{state.alarmTripped ? ' · Alarm' : ''}</span>
          </span>
        )}

        <div className="mg-progress-bar" aria-label="Recall progress">
          <div className="mg-progress-bar__label">
            <span data-testid="solo-progress">Flipped in order · {state.flipsRecorded} / {total}</span>
          </div>
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill mg-progress-bar__fill--data"
              style={{ width: `${recallProgressPct}%` }}
            />
          </div>
        </div>
      </StatusZone>

      <ChallengeZone>
        {state.phase === 'setup' && (
          <div className="mg-setup-panel" data-testid="solo-setup">
            <div className="mg-setup-panel__title">
              <Hand size={16} />
              Set up the table
            </div>
            <ol className="mg-setup-panel__steps">
              <li>Shuffle the pack.</li>
              <li>Deal <strong>{total} cards face-up in a row</strong> in front of <strong>{playerName}</strong>.</li>
            </ol>
            <p className="mg-setup-panel__rule">
              {playerName} studies the row while the clock runs. When it expires, flip every card
              face-down where it lies. They then flip cards back one at a time in
              <strong> ascending rank order</strong> (Ace low, equal ranks may follow each other).
              Every reveal is public — record each flip below.
            </p>
            <button
              type="button"
              className="mg-call-outcome-btn"
              data-testid="solo-start-study"
              onClick={handleStartStudy}
            >
              Row dealt — start the study clock
            </button>
          </div>
        )}

        {state.phase === 'study' && (
          <div data-testid="study-phase">
            <Timer
              seconds={params.studySeconds}
              running
              onExpire={handleStudyExpire}
              audible
            />
            <div className="ctb-subtext">
              {playerName} memorises the row. When the clock ends, flip every card face-down in place.
            </div>
          </div>
        )}

        {state.phase === 'recall' && (
          <div data-testid="recall-phase">
            <div className={`ctb-subtext${state.alarmTripped ? ' ctb-subtext--danger' : ''}`}>
              {state.alarmTripped
                ? 'A reveal came up lower — alarm. Reset Pin turns it back face-down once.'
                : state.flipsRecorded >= total
                  ? 'Full row flipped in order.'
                  : 'Each flip must beat (or equal) the previous card. Record every reveal.'}
            </div>

            {!gameComplete && (
              <div className="mg-record-controls" data-testid="solo-record-controls">
                <button
                  type="button"
                  className="mg-tbtn"
                  data-testid="solo-in-order"
                  onClick={handleInOrder}
                >
                  <span className="mg-tl">✓</span>
                  <span className="mg-ts">In order</span>
                </button>
                <button
                  type="button"
                  className="mg-tbtn mg-tbtn--danger"
                  data-testid="solo-clash"
                  onClick={handleClash}
                >
                  <span className="mg-tl">✗</span>
                  <span className="mg-ts">Lower — clash</span>
                </button>
              </div>
            )}
          </div>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<CrackTheTumblersSoloState, CrackTheTumblersSoloParams>
            hook={resetPinBoost}
            gameLanes={['tech']}
            committed={committed}
            onFire={handleBoost}
          />
        </div>

        {state.phase !== 'setup' && (
          <button
            type="button"
            className="mg-call-outcome-btn"
            data-testid="btn-call-outcome"
            onClick={handleCallOutcome}
          >
            Call Outcome
          </button>
        )}
      </RefereeZone>
    </div>
  );
}
