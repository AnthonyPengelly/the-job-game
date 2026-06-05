import { useState } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
import type { InsideKnowledgeParams } from './generate';
import { judge, cheatSheetBoost, narrowItDownBoost } from './judge';
import type { InsideKnowledgeState, AnswerStatus } from './judge';

function initState(questionCount: number): InsideKnowledgeState {
  return {
    answers: Array(questionCount).fill('unanswered') as AnswerStatus[],
    timerExpired: false,
    techBoostUsed: false,
    charmBoostUsed: false,
    cheatSheetIndex: -1,
    narrowItDownIndex: -1,
  };
}

export function InsideKnowledgeComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<InsideKnowledgeParams>): JSX.Element {
  const [state, setState] = useState<InsideKnowledgeState>(() => initState(params.questions.length));

  const currentIndex = state.answers.findIndex(a => a === 'unanswered');
  const allAnswered = currentIndex === -1;
  const suggested = judge(state, params);
  const correctCount = state.answers.filter(a => a === 'correct').length;
  const currentQuestion = currentIndex !== -1 ? params.questions[currentIndex] : undefined;
  const showOptions = state.narrowItDownIndex === currentIndex && currentQuestion?.options !== undefined;

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleMark(correct: boolean) {
    if (currentIndex === -1) return;
    setState(s => {
      const newAnswers = [...s.answers] as AnswerStatus[];
      newAnswers[currentIndex] = correct ? 'correct' : 'wrong';
      return { ...s, answers: newAnswers };
    });
  }

  function handleBoost(hook: BoostHook<InsideKnowledgeState, InsideKnowledgeParams>) {
    setState(s => hook.apply(s, params));
  }

  return (
    <div data-testid="inside-knowledge">
      <Timer
        seconds={params.timerSeconds}
        running={!state.timerExpired && !allAnswered}
        onExpire={handleTimerExpire}
        audible
      />

      <div data-testid="ik-header">
        <span data-testid="ik-tier">Tier: {params.tier}</span>
        <span data-testid="ik-progress">
          {' '}| Question: {allAnswered ? params.questions.length : currentIndex + 1} / {params.questions.length}
        </span>
        <span data-testid="ik-score"> | Correct: {correctCount} / {params.threshold} needed</span>
        {state.timerExpired && <span data-testid="ik-buzzer"> — BUZZER</span>}
      </div>

      {!allAnswered && currentQuestion !== undefined && (
        <div data-testid="ik-question-area">
          <div data-testid="ik-question">{currentQuestion.question}</div>
          <div data-testid="ik-answer">Answer: {currentQuestion.answer}</div>

          {showOptions && (
            <div data-testid="ik-options">
              {currentQuestion.options?.map((opt, i) => (
                <div key={i} data-testid={`ik-option-${i}`}>{opt}</div>
              ))}
            </div>
          )}

          <div data-testid="ik-mark-buttons">
            <button data-testid="ik-mark-correct" onClick={() => handleMark(true)}>
              Correct
            </button>
            <button data-testid="ik-mark-wrong" onClick={() => handleMark(false)}>
              Wrong
            </button>
          </div>
        </div>
      )}

      {allAnswered && (
        <div data-testid="ik-complete">
          All questions answered — {correctCount} / {params.questions.length} correct
        </div>
      )}

      <div data-testid="boosts">
        <BoostButton<InsideKnowledgeState, InsideKnowledgeParams>
          hook={cheatSheetBoost}
          committed={committed}
          onFire={handleBoost}
        />
        <BoostButton<InsideKnowledgeState, InsideKnowledgeParams>
          hook={narrowItDownBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
