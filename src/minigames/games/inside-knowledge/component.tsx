import { useState } from 'react';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import { ClockGate } from '@/minigames/primitives/ClockGate';
import type { InsideKnowledgeParams } from './generate';
import { judge, narrowItDownBoost } from './judge';
import type { InsideKnowledgeState, AnswerStatus } from './judge';

function initState(questionCount: number): InsideKnowledgeState {
  return {
    answers: Array(questionCount).fill('unanswered') as AnswerStatus[],
    timerExpired: false,
    charmBoostUsed: false,
    narrowItDownIndex: -1,
  };
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function InsideKnowledgeComponent({
  params,
  dial,
  committed,
  onResolve,
}: MiniGameProps<InsideKnowledgeParams>): JSX.Element {
  const [state, setState] = useState<InsideKnowledgeState>(() => initState(params.questions.length));
  // Wave 3: the GM starts the clock — questions stay hidden until then.
  const [clockStarted, setClockStarted] = useState(false);

  const currentIndex = state.answers.findIndex(a => a === 'unanswered');
  const allAnswered = currentIndex === -1;
  const correctCount = state.answers.filter(a => a === 'correct').length;
  const totalAnswered = state.answers.filter(a => a !== 'unanswered').length;
  const fillPct = Math.min((totalAnswered / params.questions.length) * 100, 100);

  const currentQuestion = currentIndex !== -1 ? params.questions[currentIndex] : undefined;
  const isNarrowed = state.narrowItDownIndex === currentIndex && currentQuestion?.options !== undefined;

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

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  return (
    <div data-testid="inside-knowledge">
      <StatusZone>
        <span
          className={`mg-status-badge${state.timerExpired && !allAnswered ? ' mg-status-badge--botched' : allAnswered ? (judge(state, params) === 'clean' ? ' mg-status-badge--clean' : judge(state, params) === 'complication' ? ' mg-status-badge--complication' : ' mg-status-badge--botched') : ' mg-status-badge--active'}`}
          data-testid="ik-status-badge"
        >
          {state.timerExpired && !allAnswered
            ? 'BUZZER'
            : allAnswered
              ? (judge(state, params) === 'clean' ? 'PASS' : judge(state, params) === 'complication' ? 'SCRAPED' : 'FAIL')
              : isNarrowed
                ? 'Active · narrowed'
                : 'Active'}
        </span>
        <Timer
          seconds={params.timerSeconds}
          running={clockStarted && !state.timerExpired && !allAnswered}
          onExpire={handleTimerExpire}
          audible
        />
        <div className="mg-progress-bar" data-testid="ik-progress-bar">
          <div className="mg-progress-bar__label">
            <span data-testid="ik-progress">
              {allAnswered ? params.questions.length : currentIndex + 1} / {params.questions.length} · {correctCount} right
            </span>
          </div>
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
        <span data-testid="ik-score" className="mg-dial-inline">
          need {params.threshold}
        </span>
        <span data-testid="ik-dial" className="mg-dial-inline">
          Dial {dial.level.toFixed(1)}
        </span>
      </StatusZone>

      <ChallengeZone>
        {!clockStarted && !allAnswered && (
          <ClockGate
            hint={`Explain the drill: ${params.questions.length} questions, the table confers, you mark each spoken answer. They need ${params.threshold} right. The first question appears when you start.`}
            onStart={() => setClockStarted(true)}
          />
        )}
        {clockStarted && !allAnswered && currentQuestion !== undefined && (
          <div className="ik-qa" data-testid="ik-question-area">
            <div className="ik-question" data-testid="ik-question">
              {currentQuestion.question}
            </div>

            {!isNarrowed && (
              <div className="ik-answer" data-testid="ik-answer">
                <Eye size={14} className="ik-answer-icon" />
                <div>
                  <span className="ik-answer-label">Answer · GM only</span>
                  <br />
                  <span className="ik-answer-value" data-testid="ik-answer-value">
                    {currentQuestion.answer}
                  </span>
                </div>
              </div>
            )}

            {isNarrowed && currentQuestion.options !== undefined && (
              <div className="ik-opts4" data-testid="ik-options">
                {currentQuestion.options.map((opt, i) => {
                  const isCorrect = opt === currentQuestion.answer;
                  return (
                    <div
                      key={i}
                      data-testid={`ik-option-${i}`}
                      className={`ik-opt4${isCorrect ? ' ik-opt4--correct' : ''}`}
                    >
                      <span className="ik-opt-letter">{OPTION_LETTERS[i]}</span>
                      <span className="ik-opt-text">{opt}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {allAnswered && (
          <div data-testid="ik-complete" className="ik-complete">
            All questions answered — {correctCount} / {params.questions.length} correct
          </div>
        )}
      </ChallengeZone>

      <RefereeZone>
        {!allAnswered && currentQuestion !== undefined && (
          <div className="ik-mark-buttons" data-testid="ik-mark-buttons">
            <button
              data-testid="ik-mark-correct"
              className="mg-mark-btn mg-mark-btn--correct"
              onClick={() => handleMark(true)}
            >
              <CheckCircle size={16} /> Correct
            </button>
            <button
              data-testid="ik-mark-wrong"
              className="mg-mark-btn mg-mark-btn--wrong"
              onClick={() => handleMark(false)}
            >
              <XCircle size={16} /> Wrong
            </button>
          </div>
        )}
        <div className="mg-boost-slot">
          <BoostButton<InsideKnowledgeState, InsideKnowledgeParams>
            hook={narrowItDownBoost}
            gameLanes={['tech', 'charm']}
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
