import { useState } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { CardSpread } from '@/minigames/primitives/CardSpread';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
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

  return (
    <div data-testid="crack-the-tumblers-solo">
      <div data-testid="ctt-solo-info">
        <span data-testid="ctt-solo-phase">Phase: {state.phase}</span>
        {state.phase === 'recall' && (
          <span> | Recalled: {state.recallSequence.length}/{params.correctOrder.length}</span>
        )}
        {state.alarmTripped && <span data-testid="solo-alarm-tripped"> — ALARM TRIPPED</span>}
      </div>

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
          <button data-testid="start-recall" onClick={handleStartRecall}>
            Start Recall
          </button>
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

      <div data-testid="boosts">
        <BoostButton<CrackTheTumblersSoloState, CrackTheTumblersSoloParams>
          hook={resetPinBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
