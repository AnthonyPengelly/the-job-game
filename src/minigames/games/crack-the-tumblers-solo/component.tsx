import { useState } from 'react';
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
  const [studyElapsedPct, setStudyElapsedPct] = useState(0);

  const gameComplete = state.alarmTripped || state.recallSequence.length === params.correctOrder.length;

  function handleStudyExpire() {
    setState(s => ({ ...s, phase: 'recall' }));
  }

  function handleStudyTick(remaining: number) {
    const elapsed = params.studySeconds - remaining;
    setStudyElapsedPct(Math.min((elapsed / params.studySeconds) * 100, 100));
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
  const recallProgressPct = total > 0 ? (recalled / total) * 100 : 0;

  return (
    <div data-testid="crack-the-tumblers-solo">
      <StatusZone>
        {state.phase === 'study' ? (
          <span className="mg-status-badge mg-status-badge--active">
            <Eye size={14} />
            <span data-testid="ctt-solo-phase">Study</span>
          </span>
        ) : (
          <span className={`mg-status-badge ${state.alarmTripped ? 'mg-status-badge--botched' : 'mg-status-badge--active'}`}>
            {state.alarmTripped ? <Siren size={14} /> : <RotateCcw size={14} />}
            <span data-testid="ctt-solo-phase">Recall{state.alarmTripped ? ' · Alarm' : ''}</span>
          </span>
        )}

        <div className="mg-progress-bar" aria-label={state.phase === 'study' ? 'Study window' : 'Recall progress'}>
          <div className="mg-progress-bar__label">
            {state.phase === 'study'
              ? <span>Memorise · {total} pins</span>
              : <span>Recalled · {recalled} / {total}</span>}
          </div>
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill mg-progress-bar__fill--data"
              style={{ width: `${state.phase === 'study' ? studyElapsedPct : recallProgressPct}%` }}
            />
          </div>
        </div>

        {state.phase === 'recall' && !state.alarmTripped && (
          <span className="mg-status-badge mg-status-badge--clean">
            <ShieldCheck size={14} />
            Clear
          </span>
        )}
      </StatusZone>

      <ChallengeZone>
        {state.phase === 'study' ? (
          <div data-testid="study-phase">
            <Timer
              seconds={params.studySeconds}
              running
              onExpire={handleStudyExpire}
              onTick={handleStudyTick}
              audible={false}
            />

            {/* Pin board: all pins shown ascending for study */}
            <div className="ctb-pinboard" aria-label="Study sequence">
              {params.studyCards.map(card => (
                <div key={card.id} className="ctb-pin ctb-pin--played" data-testid={`study-pin-${card.id}`}>
                  {card.label}
                </div>
              ))}
            </div>
            <div className="ctb-subtext">Memorise this sequence — you will recall it in order.</div>
          </div>
        ) : (
          <div data-testid="recall-phase">
            {/* Recall pin board: recalled pins lit, next slot dashed, rest face-down */}
            <div className="ctb-pinboard" aria-label="Recall board">
              {params.correctOrder.map((id, i) => {
                const isRecalled = i < recalled;
                const isNext = i === recalled && !gameComplete;
                const recalledId = state.recallSequence[i];
                const card = params.studyCards.find(c => c.id === id);
                const recalledCard = recalledId !== undefined
                  ? params.recallCards.find(c => c.id === recalledId)
                  : null;
                const clashIndex = state.alarmTripped ? recalled - 1 : -1;
                const isClash = state.alarmTripped && i === clashIndex;

                if (isRecalled) {
                  return (
                    <div
                      key={id}
                      className={`ctb-pin ${isClash ? 'ctb-pin--clash' : 'ctb-pin--played'}`}
                      data-testid={`recalled-pin-${i}`}
                    >
                      {recalledCard?.label ?? card?.label ?? '?'}
                    </div>
                  );
                }
                if (isNext) {
                  return (
                    <div key={id} className="ctb-pin ctb-pin--next" data-testid="recall-next">
                      ?
                    </div>
                  );
                }
                return (
                  <div key={id} className="ctb-pin ctb-pin--empty" data-testid={`recall-empty-${i}`} />
                );
              })}
            </div>

            {state.alarmTripped && (
              <div className="ctb-subtext ctb-subtext--danger" data-testid="solo-alarm-tripped">
                Wrong pin — alarm tripped. Reset Pin undoes one mistake.
              </div>
            )}

            {/* Recall spread — tap to select */}
            {!gameComplete && (
              <div className="ctb-hand">
                <div className="ctb-hand-label">Tap to recall:</div>
                <CardSpread
                  cards={params.recallCards}
                  layout="row"
                  faceDown={state.recallSequence}
                  onTap={handleRecallTap}
                />
              </div>
            )}

            {/* Recall sequence readout */}
            <div className="ctb-played-row" data-testid="recall-sequence">
              {state.recallSequence.map((id, i) => {
                const card = params.recallCards.find(c => c.id === id);
                return (
                  <span key={id} data-testid={`recalled-${i}`} className="ctb-played-val">
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
            gameLanes={['tech']}
            committed={committed}
            onFire={handleBoost}
          />
        </div>

        {state.phase === 'study' && (
          <button
            type="button"
            className="mg-call-outcome-btn"
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
