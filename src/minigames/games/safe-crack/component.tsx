import { useState } from 'react';
import { CheckCircle, XCircle, Lock } from 'lucide-react';
import type { MiniGameProps } from '@/minigames/contract';
import type { BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { SafeCrackParams } from './generate';
import { computeFeedback, judge, techBoost } from './judge';
import type { SafeCrackState } from './judge';

function initState(guessBudget: number): SafeCrackState {
  return {
    guesses: [],
    guessesRemaining: guessBudget,
    solved: false,
    techBoostUsed: false,
  };
}

export function SafeCrackComponent({ params, committed, onResolve }: MiniGameProps<SafeCrackParams>): JSX.Element {
  const [state, setState] = useState<SafeCrackState>(() => initState(params.guessBudget));
  const [currentInput, setCurrentInput] = useState('');
  const [timerRunning, setTimerRunning] = useState(true);

  const gameOver = state.solved || state.guessesRemaining === 0;
  const fillPct = state.solved
    ? 100
    : Math.max(0, ((params.guessBudget - state.guessesRemaining) / params.guessBudget) * 100);

  let badgeClass = 'mg-status-badge mg-status-badge--active';
  let badgeIcon: React.ReactNode = <Lock size={14} />;
  let badgeLabel = 'Cracking';
  if (state.solved) {
    badgeClass = 'mg-status-badge mg-status-badge--clean';
    badgeIcon = <CheckCircle size={14} />;
    badgeLabel = 'CRACKED';
  } else if (gameOver) {
    badgeClass = 'mg-status-badge mg-status-badge--botched';
    badgeIcon = <XCircle size={14} />;
    badgeLabel = 'LOCKED';
  }

  function handleTimerExpire() {
    setTimerRunning(false);
  }

  function handleBoost(hook: BoostHook<SafeCrackState, SafeCrackParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleGuessSubmit() {
    if (gameOver) return;
    const digits = currentInput.replace(/\D/g, '').split('').map(Number);
    if (digits.length !== params.code.length) return;

    const feedback = computeFeedback(params.code, digits);
    const solved = feedback.rightPlace === params.code.length;
    const newRemaining = state.guessesRemaining - 1;

    setState(s => ({
      ...s,
      guesses: [...s.guesses, { guess: digits, ...feedback }],
      guessesRemaining: newRemaining,
      solved,
    }));
    setCurrentInput('');

    if (solved || newRemaining === 0) {
      setTimerRunning(false);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleGuessSubmit();
  }

  function handleCallOutcome() {
    onResolve(judge(state));
  }

  return (
    <div data-testid="safe-crack">
      <StatusZone>
        <span className={badgeClass}>
          {badgeIcon}
          <span>{badgeLabel}</span>
        </span>
        <span data-testid="code-length">{params.code.length}-digit code</span>
        <div className="mg-progress-bar">
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <span className="mg-progress-bar__label" data-testid="guesses-remaining">
            {state.guessesRemaining} guess{state.guessesRemaining !== 1 ? 'es' : ''} left
          </span>
        </div>
        <Timer
          seconds={params.timerSeconds}
          running={timerRunning}
          onExpire={handleTimerExpire}
          audible
        />
      </StatusZone>

      <ChallengeZone>
        <div data-testid="guess-history">
          {state.guesses.map((g, i) => (
            <div key={i} data-testid={`guess-row-${i}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span data-testid={`guess-digits-${i}`} className="mg-card-label">
                {g.guess.join(' ')}
              </span>
              <span data-testid={`guess-right-place-${i}`} style={{ color: 'var(--c-green-200, #b6f7d2)' }}>
                {'■'.repeat(g.rightPlace)}
              </span>
              <span data-testid={`guess-right-digit-${i}`} style={{ color: 'var(--caution, #f7b84b)' }}>
                {'□'.repeat(g.rightDigit)}
              </span>
            </div>
          ))}
        </div>

        {state.stethoscopeReveal !== undefined && (
          <div data-testid="stethoscope-hint" className="mg-status-badge mg-status-badge--complication" style={{ marginTop: '0.5rem' }}>
            Position {state.stethoscopeReveal.position + 1} = {state.stethoscopeReveal.digit}
          </div>
        )}

        {!gameOver && (
          <div data-testid="guess-input-area" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <input
              data-testid="guess-input"
              type="text"
              value={currentInput}
              maxLength={params.code.length}
              onChange={e => setCurrentInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={`${params.code.length}-digit guess`}
              style={{ fontFamily: 'var(--font-data)', fontSize: '1rem', padding: '0.4rem 0.6rem', borderRadius: 4 }}
            />
            <button
              data-testid="guess-submit"
              className="mg-call-outcome-btn"
              onClick={handleGuessSubmit}
              disabled={currentInput.replace(/\D/g, '').length !== params.code.length}
            >
              Submit
            </button>
          </div>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<SafeCrackState, SafeCrackParams>
            hook={techBoost}
            gameLanes={['tech', 'stealth']}
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
