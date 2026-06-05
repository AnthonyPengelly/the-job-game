import { useGameStore } from '@/console/store';

/**
 * GM console screen for the result phase.
 *
 * Shows the run outcome (win or bust), the final score, a score breakdown
 * (loot banked, heat at Getaway, multiplier applied), and a "Go again" button
 * that calls goAgain() — clears the save and returns to Setup.
 */
export function Result() {
  const state = useGameStore(s => s.session.present);
  const cfg = useGameStore(s => s.cfg);
  const goAgain = useGameStore(s => s.goAgain);

  const win = state.win ?? false;
  const finalScore = state.finalScore ?? 0;

  const multiplier = win
    ? cfg.scoring.winBaseMultiplier +
      cfg.scoring.lowHeatStyleBonus * (1 - state.heat / cfg.heat.hMax)
    : cfg.scoring.bustMultiplier;

  return (
    <div data-testid="screen-result">
      <h2 data-testid="result-outcome">{win ? 'Win' : 'Bust'}</h2>

      <p data-testid="result-final-score">Final score: {finalScore}</p>

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
