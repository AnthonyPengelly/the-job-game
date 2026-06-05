import { useGameStore } from '@/console/store';

/**
 * GM console screen for the getaway phase (stub).
 *
 * Three resolution paths:
 *   "Resolve" — seeded roll; the engine draws from the run RNG and decides win/bust.
 *   "Win (GM)"  — GM forces a win: dispatches RESOLVE_GETAWAY { win: true }.
 *   "Bust (GM)" — GM forces a bust: dispatches RESOLVE_GETAWAY { win: false }.
 *
 * The real Heat-scaled Articulate finale is E6; this is the stub outcome picker
 * that stands in until then.
 */
export function GetawayStub() {
  const dispatch = useGameStore(s => s.dispatch);

  function handleSeededResolve() {
    dispatch({ t: 'RESOLVE_GETAWAY' });
  }

  function handleWin() {
    dispatch({ t: 'RESOLVE_GETAWAY', win: true });
  }

  function handleBust() {
    dispatch({ t: 'RESOLVE_GETAWAY', win: false });
  }

  return (
    <div data-testid="screen-getaway">
      <h2>Getaway</h2>
      <p>Resolve the getaway:</p>
      <button data-testid="btn-resolve-getaway" onClick={handleSeededResolve}>
        Resolve (seeded roll)
      </button>
      <button data-testid="btn-win" onClick={handleWin}>
        Win (GM)
      </button>
      <button data-testid="btn-bust" onClick={handleBust}>
        Bust (GM)
      </button>
    </div>
  );
}
