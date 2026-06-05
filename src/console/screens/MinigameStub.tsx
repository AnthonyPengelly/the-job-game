import { useGameStore } from '@/console/store';
import type { Outcome } from '@/engine';

const OUTCOME_LABELS: Record<Outcome, string> = {
  clean: 'Clean',
  complication: 'Complication',
  botched: 'Botched',
};

/**
 * GM outcome-picker stub for the minigame phase.
 * Stands in for real mini-games (E4/E5): the GM selects clean / complication / botched,
 * dispatching RESOLVE_MINIGAME which feeds the engine and advances to the Offer.
 */
export function MinigameStub() {
  const dispatch = useGameStore(s => s.dispatch);

  function resolve(outcome: Outcome) {
    dispatch({ t: 'RESOLVE_MINIGAME', outcome });
  }

  return (
    <div data-testid="screen-minigame">
      <h2>Mini-game Outcome</h2>
      <p>Select the outcome:</p>
      <button data-testid="btn-outcome-clean" onClick={() => resolve('clean')}>
        {OUTCOME_LABELS.clean}
      </button>
      <button data-testid="btn-outcome-complication" onClick={() => resolve('complication')}>
        {OUTCOME_LABELS.complication}
      </button>
      <button data-testid="btn-outcome-botched" onClick={() => resolve('botched')}>
        {OUTCOME_LABELS.botched}
      </button>
    </div>
  );
}
