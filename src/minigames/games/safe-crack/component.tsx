import { useState } from 'react';
import type { MiniGameProps } from '@/minigames/contract';
import type { BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
import type { SafeCrackParams } from './generate';
import { computeFeedback, judge, techBoost, stealthBoost } from './judge';
import type { SafeCrackState } from './judge';

function initState(guessBudget: number): SafeCrackState {
  return {
    guesses: [],
    guessesRemaining: guessBudget,
    solved: false,
    techBoostUsed: false,
    stealthBoostUsed: false,
  };
}

export function SafeCrackComponent({ params, committed, onResolve }: MiniGameProps<SafeCrackParams>): JSX.Element {
  const [state, setState] = useState<SafeCrackState>(() => initState(params.guessBudget));
  const [currentInput, setCurrentInput] = useState('');
  const [timerRunning, setTimerRunning] = useState(true);

  const gameOver = state.solved || state.guessesRemaining === 0;
  const suggested = judge(state);

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

  return (
    <div data-testid="safe-crack">
      <Timer
        seconds={params.timerSeconds}
        running={timerRunning}
        onExpire={handleTimerExpire}
        audible
      />

      <div data-testid="safe-crack-info">
        <span data-testid="code-length">Code: {params.code.length} digits</span>
        <span data-testid="guesses-remaining"> | Guesses remaining: {state.guessesRemaining}</span>
      </div>

      <div data-testid="guess-history">
        {state.guesses.map((g, i) => (
          <div key={i} data-testid={`guess-row-${i}`}>
            <span data-testid={`guess-digits-${i}`}>[{g.guess.join('][')}]</span>
            <span data-testid={`guess-right-place-${i}`}> ✓{g.rightPlace}</span>
            <span data-testid={`guess-right-digit-${i}`}> ⟲{g.rightDigit}</span>
          </div>
        ))}
      </div>

      {state.stethoscopeReveal !== undefined && (
        <div data-testid="stethoscope-hint">
          Stethoscope: Position {state.stethoscopeReveal.position + 1} is {state.stethoscopeReveal.digit}
        </div>
      )}

      {!gameOver && (
        <div data-testid="guess-input-area">
          <input
            data-testid="guess-input"
            type="text"
            value={currentInput}
            maxLength={params.code.length}
            onChange={e => setCurrentInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={`${params.code.length}-digit guess`}
          />
          <button
            data-testid="guess-submit"
            onClick={handleGuessSubmit}
            disabled={currentInput.replace(/\D/g, '').length !== params.code.length}
          >
            Submit guess
          </button>
        </div>
      )}

      <div data-testid="boosts">
        <BoostButton<SafeCrackState, SafeCrackParams>
          hook={techBoost}
          committed={committed}
          onFire={handleBoost}
        />
        <BoostButton<SafeCrackState, SafeCrackParams>
          hook={stealthBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
