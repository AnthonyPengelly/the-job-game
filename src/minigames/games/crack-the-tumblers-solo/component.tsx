import { useState, useEffect } from 'react';
import { Eye, RotateCcw, ShieldCheck, Siren } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { CardSpread } from '@/minigames/primitives/CardSpread';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { CrackTheTumblersSoloParams } from './generate';
import { judge, resetPinBoost } from './judge';
import type { CrackTheTumblersSoloState } from './judge';

function initState(): CrackTheTumblersSoloState {
  return {
    phase: 'study',
    recallSequence: [],
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

  const gameComplete = state.alarmTripped || state.recallSequence.length === params.correctOrder.length;
  const suggested = judge(state, params);

  // Auto-resolve when game is complete
  useEffect(() => {
    if (gameComplete) {
      onResolve(suggested);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameComplete]);

  function handleStudyExpire() {
    setState(s => ({ ...s, phase: 'recall' }));
  }

  function handleStartRecall() {
    setState(s => ({ ...s, phase: 'recall' }));
  }

  function handleRecallTap(id: CardId) {
    if (gameComplete || state.phase !== 'recall') return;
    if (state.recallSequence.includes(id)) return;

    const expectedId = params.correctOrder[state.recallSequence.length];
    const isWrong = id !== expectedId;

    setState(s => ({
      ...s,
      recallSequence: [...s.recallSequence, id],
      alarmTripped: isWrong,
    }));
  }

  function handleBoost(hook: BoostHook<CrackTheTumblersSoloState, CrackTheTumblersSoloParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  const recalled = state.recallSequence.length;
  const total = params.correctOrder.length;
  const progressPct = total > 0 ? (recalled / total) * 100 : 0;

  return (
    <div data-testid="crack-the-tumblers-solo">
      <StatusZone>
        {state.phase === 'study' ? (
          <span className="mg-status-badge mg-status-badge--active">
            <Eye size={14} />
            <span data-testid="ctt-solo-phase">Phase: study</span>
          </span>
        ) : (
          <span className={`mg-status-badge ${state.alarmTripped ? 'mg-status-badge--botched' : 'mg-status-badge--active'}`}>
            <RotateCcw size={14} />
            <span data-testid="ctt-solo-phase">Phase: recall</span>
          </span>
        )}

        {state.phase === 'recall' && (
          <div className="mg-progress-bar" aria-label="Recall progress">
            <div className="mg-progress-bar__label">
              Recalled: {recalled}/{total}
            </div>
            <div className="mg-progress-bar__track">
              <div
                className="mg-progress-bar__fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {state.alarmTripped ? (
          <span className="mg-status-badge mg-status-badge--botched" data-testid="solo-alarm-tripped">
            <Siren size={14} />
            ALARM
          </span>
        ) : (
          <span className="mg-status-badge mg-status-badge--clean">
            <ShieldCheck size={14} />
            Clear
          </span>
        )}
      </StatusZone>

      <ChallengeZone>
        {state.phase === 'study' ? (
          <div data-testid="study-phase">
            <p>Memorise this sequence:</p>
            <CardSpread cards={params.studyCards} layout="row" />
            <Timer
              seconds={params.studySeconds}
              running
              onExpire={handleStudyExpire}
              audible={false}
            />
          </div>
        ) : (
          <div data-testid="recall-phase">
            <p>Recall the sequence — tap in ascending order:</p>
            <CardSpread
              cards={params.recallCards}
              layout="row"
              faceDown={state.recallSequence}
              {...(!gameComplete && state.phase === 'recall' && { onTap: handleRecallTap })}
            />
            <div data-testid="recall-sequence">
              {state.recallSequence.map((id, i) => {
                const card = params.recallCards.find(c => c.id === id);
                return (
                  <span key={id} data-testid={`recalled-${i}`}>
                    {i > 0 ? ' → ' : ''}{card?.label ?? '?'}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<CrackTheTumblersSoloState, CrackTheTumblersSoloParams>
            hook={resetPinBoost}
            committed={committed}
            onFire={handleBoost}
          />
        </div>

        {state.phase === 'study' && (
          <button
            type="button"
            data-testid="start-recall"
            onClick={handleStartRecall}
          >
            Start Recall
          </button>
        )}

        {state.phase === 'recall' && (
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
