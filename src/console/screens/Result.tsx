import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { getawayMultiplier } from '@/engine/scoring';
import { Teleprompter } from '@/console/teleprompter';

/**
 * GM console screen for the result phase.
 *
 * Shows the run outcome (win or bust), the final score, a score breakdown
 * (loot banked, heat at Getaway, multiplier applied), and a "Go again" button
 * that calls goAgain() — clears the save and returns to Setup.
 *
 * A winSting or bustSting narration line is surfaced via Teleprompter based on
 * the session outcome.
 */
export function Result() {
  const state = useGameStore(s => s.session.present);
  const cfg = useGameStore(s => s.cfg);
  const goAgain = useGameStore(s => s.goAgain);
  const director = useGameStore(s => s.director);

  const win = state.win ?? false;
  const finalScore = state.finalScore ?? 0;

  const multiplier = getawayMultiplier(state.heat, win, cfg);

  const stingBeat = win ? 'winSting' : 'bustSting' as const;

  const [stingLine, setStingLine] = useState<string>(() =>
    director?.next(stingBeat) ?? ''
  );

  function handleStingAdvance() {
    if (!director) return;
    setStingLine(director.next(stingBeat));
  }

  return (
    <div data-testid="screen-result">
      <h2 data-testid="result-outcome">{win ? 'Win' : 'Bust'}</h2>

      {stingLine !== '' && (
        <div data-testid="result-sting">
          <Teleprompter line={stingLine} onAdvance={handleStingAdvance} />
        </div>
      )}

      <p data-testid="result-final-score">Final score: {finalScore.toFixed(2)}</p>

      <div data-testid="result-breakdown">
        <p data-testid="breakdown-loot">Loot banked: {state.loot}</p>
        <p data-testid="breakdown-heat">Heat at getaway: {state.heat}</p>
        <p data-testid="breakdown-multiplier">Multiplier: {multiplier.toFixed(2)}x</p>
      </div>

      <button data-testid="btn-go-again" onClick={goAgain}>
        Go Again
      </button>
    </div>
  );
}
