import { useState } from 'react';
import { CheckCircle, XCircle, Lock, Eye } from 'lucide-react';
import type { MiniGameProps } from '@/minigames/contract';
import type { BoostHook } from '@/minigames/contract';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { Timer } from '@/minigames/primitives/Timer';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import { ClockGate } from '@/minigames/primitives/ClockGate';
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
  const [timerExpired, setTimerExpired] = useState(false);
  // Wave 3: the GM starts the clock — no auto-start while they explain.
  const [clockStarted, setClockStarted] = useState(false);

  const gameOver = state.solved || state.guessesRemaining === 0 || timerExpired;
  const guessesUsed = params.guessBudget - state.guessesRemaining;
  const fillPct = state.solved
    ? 100
    : Math.min((guessesUsed / params.guessBudget) * 100, 100);

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

  function handleBoost(hook: BoostHook<SafeCrackState, SafeCrackParams>) {
    setState(s => hook.apply(s, params));
  }

  // A guess is only legal when every digit sits inside the announced pool —
  // stops the GM burning a try on a digit the code can't contain.
  function parseGuess(input: string): number[] | null {
    const digits = input.replace(/\D/g, '').split('').map(Number);
    if (digits.length !== params.code.length) return null;
    if (digits.some(d => d < params.digitMin || d > params.digitMax)) return null;
    return digits;
  }

  function handleGuessSubmit() {
    if (gameOver) return;
    const digits = parseGuess(currentInput);
    if (digits === null) return;

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
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleGuessSubmit();
  }

  function handleCallOutcome() {
    onResolve(judge(state));
  }

  const maskedCode = state.stethoscopeReveal !== undefined
    ? params.code.map((d, i) => i === state.stethoscopeReveal!.position ? String(d) : '_').join(' ')
    : null;

  return (
    <div data-testid="safe-crack">
      <StatusZone>
        <span className={badgeClass}>
          {badgeIcon}
          <span>{badgeLabel}</span>
        </span>
        <span data-testid="code-length" className="mg-dial-inline">
          {params.code.length}-digit code · digits {params.digitMin}–{params.digitMax} · {params.guessBudget} tries
        </span>
        <Timer
          seconds={params.timerSeconds}
          running={clockStarted && !gameOver}
          onExpire={() => setTimerExpired(true)}
          audible
        />
        <div className="mg-progress-bar" data-testid="sc-progress">
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill mg-progress-bar__fill--data"
              style={{ width: `${fillPct}%` }}
              data-testid="sc-progress-fill"
            />
          </div>
          <span className="mg-progress-bar__label" data-testid="guesses-remaining">
            Guesses used · {guessesUsed} / {params.guessBudget}
          </span>
        </div>
      </StatusZone>

      <ChallengeZone>
        {!clockStarted && !gameOver && (
          <ClockGate
            hint={`Announce the pool out loud — "${params.code.length} digits, ${params.digitMin} to ${params.digitMax} only, duplicates allowed" — and how the feedback works. Start when the crew is ready.`}
            onStart={() => setClockStarted(true)}
          />
        )}
        {maskedCode && (
          <div data-testid="stethoscope-hint" className="sc-gm-code" style={{ marginBottom: '0.75rem' }}>
            <Eye size={16} style={{ color: 'var(--data, #00bcd4)', flexShrink: 0 }} />
            <div>
              <div className="sc-gm-code-label">Code · GM only</div>
              <div className="sc-gm-code-value">{maskedCode}</div>
            </div>
          </div>
        )}

        <div className="sc-guess-history" data-testid="guess-history">
          {state.guesses.map((g, i) => {
            const isCurrent = i === state.guesses.length - 1;
            return (
              <div
                key={i}
                data-testid={`guess-row-${i}`}
                className={`sc-guess-row${isCurrent ? ' sc-guess-row--current' : ''}`}
              >
                <span data-testid={`guess-digits-${i}`} className="sc-guess-digits">
                  {g.guess.join(' ')}
                </span>
                <div className="sc-pegs" data-testid={`guess-pegs-${i}`}>
                  {Array.from({ length: g.rightPlace }).map((_, j) => (
                    <div key={`p-${j}`} className="sc-peg sc-peg--place" />
                  ))}
                  {Array.from({ length: g.rightDigit }).map((_, j) => (
                    <div key={`d-${j}`} className="sc-peg sc-peg--digit" />
                  ))}
                  {Array.from({ length: params.code.length - g.rightPlace - g.rightDigit }).map((_, j) => (
                    <div key={`e-${j}`} className="sc-peg" />
                  ))}
                </div>
                <span data-testid={`guess-right-place-${i}`} style={{ display: 'none' }}>{g.rightPlace}</span>
                <span data-testid={`guess-right-digit-${i}`} style={{ display: 'none' }}>{g.rightDigit}</span>
              </div>
            );
          })}
        </div>

        {state.guesses.length > 0 && (
          <div className="sc-peg-legend" data-testid="peg-legend">
            <span className="sc-peg-legend-item"><div className="sc-peg sc-peg--place" />Right digit &amp; place</span>
            <span className="sc-peg-legend-item"><div className="sc-peg sc-peg--digit" />Right digit, wrong place</span>
          </div>
        )}

        {clockStarted && !gameOver && (
          <div data-testid="guess-input-area" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <input
              data-testid="guess-input"
              type="text"
              value={currentInput}
              maxLength={params.code.length}
              onChange={e => setCurrentInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={`${params.code.length} digits, ${params.digitMin}–${params.digitMax} each`}
              style={{ fontFamily: 'var(--font-data)', fontSize: '1rem', padding: '0.4rem 0.6rem', borderRadius: 4 }}
            />
            <button
              data-testid="guess-submit"
              className="mg-call-outcome-btn"
              onClick={handleGuessSubmit}
              disabled={parseGuess(currentInput) === null}
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
