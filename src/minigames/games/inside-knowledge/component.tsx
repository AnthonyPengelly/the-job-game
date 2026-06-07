import { useState } from 'react';
import { CheckCircle, XCircle, HelpCircle, BookOpen } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
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
  const correctCount = state.answers.filter(a => a === 'correct').length;
  const totalAnswered = state.answers.filter(a => a !== 'unanswered').length;
  const fillPct = Math.min((totalAnswered / params.questions.length) * 100, 100);

  const currentQuestion = currentIndex !== -1 ? params.questions[currentIndex] : undefined;
  const showOptions = state.narrowItDownIndex === currentIndex && currentQuestion?.options !== undefined;

  // Status badge
  let badgeClass = 'mg-status-badge mg-status-badge--active';
  let badgeIcon: React.ReactNode = <BookOpen size={14} />;
  let badgeLabel = 'In Progress';
  if (allAnswered) {
    const outcome = judge(state, params);
    if (outcome === 'clean') {
      badgeClass = 'mg-status-badge mg-status-badge--clean';
      badgeIcon = <CheckCircle size={14} />;
      badgeLabel = 'PASS';
    } else if (outcome === 'complication') {
      badgeClass = 'mg-status-badge mg-status-badge--complication';
      badgeIcon = <CheckCircle size={14} />;
      badgeLabel = 'SCRAPED';
    } else {
      badgeClass = 'mg-status-badge mg-status-badge--botched';
      badgeIcon = <XCircle size={14} />;
      badgeLabel = 'FAIL';
    }
  } else if (state.timerExpired) {
    badgeClass = 'mg-status-badge mg-status-badge--botched';
    badgeIcon = <XCircle size={14} />;
    badgeLabel = 'BUZZER';
  }

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
        <span className={badgeClass}>
          {badgeIcon}
          <span data-testid="ik-status-badge">{badgeLabel}</span>
        </span>
        <span data-testid="ik-tier">Tier: {params.tier}</span>
        <div className="mg-progress-bar">
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <span className="mg-progress-bar__label" data-testid="ik-progress">
            {allAnswered ? params.questions.length : currentIndex + 1} / {params.questions.length}
          </span>
        </div>
        <span data-testid="ik-score">
          {correctCount} / {params.threshold} needed
        </span>
        <Timer
          seconds={params.timerSeconds}
          running={!state.timerExpired && !allAnswered}
          onExpire={handleTimerExpire}
          audible
        />
        {state.timerExpired && <span data-testid="ik-buzzer">BUZZER</span>}
      </StatusZone>

      <ChallengeZone>
        {!allAnswered && currentQuestion !== undefined && (
          <div data-testid="ik-question-area">
            <div data-testid="ik-question" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {currentQuestion.question}
            </div>
            <div data-testid="ik-answer" style={{ color: 'var(--fg-muted, #a4b2ad)', marginTop: '0.5rem' }}>
              <HelpCircle size={14} style={{ display: 'inline', marginRight: 4 }} />
              {currentQuestion.answer}
            </div>

            {showOptions && (
              <div data-testid="ik-options" style={{ marginTop: '0.5rem' }}>
                {currentQuestion.options?.map((opt, i) => (
                  <div key={i} data-testid={`ik-option-${i}`} className="mg-card-label">
                    {opt}
                  </div>
                ))}
              </div>
            )}

            <div data-testid="ik-mark-buttons" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                data-testid="ik-mark-correct"
                className="mg-status-badge mg-status-badge--clean"
                onClick={() => handleMark(true)}
                style={{ cursor: 'pointer', border: 'none', padding: '0.4rem 1rem' }}
              >
                <CheckCircle size={14} /> Correct
              </button>
              <button
                data-testid="ik-mark-wrong"
                className="mg-status-badge mg-status-badge--botched"
                onClick={() => handleMark(false)}
                style={{ cursor: 'pointer', border: 'none', padding: '0.4rem 1rem' }}
              >
                <XCircle size={14} /> Wrong
              </button>
            </div>
          </div>
        )}

        {allAnswered && (
          <div data-testid="ik-complete" style={{ fontWeight: 600 }}>
            All questions answered — {correctCount} / {params.questions.length} correct
          </div>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<InsideKnowledgeState, InsideKnowledgeParams>
            hook={cheatSheetBoost}
            committed={committed}
            onFire={handleBoost}
          />
        </div>
        <div className="mg-boost-slot">
          <BoostButton<InsideKnowledgeState, InsideKnowledgeParams>
            hook={narrowItDownBoost}
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
