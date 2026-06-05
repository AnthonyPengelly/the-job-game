import { useGameStore } from '@/console/store';

/**
 * GM console screen for the offer phase.
 *
 * "Push on" → PUSH_ON (engine advances to the next room, or routes to getaway
 * if heat ≥ HMAX — the forced-getaway path is handled entirely in the reducer).
 * "Call the Getaway" → CALL_GETAWAY (immediately enters getaway phase).
 *
 * The escape-signal hint ("getting hot — we can roll") is shown exactly when
 * state.escapeSignal is true (heat is at or above the run-at fraction).
 */
export function Offer() {
  const dispatch = useGameStore(s => s.dispatch);
  const escapeSignal = useGameStore(s => s.session.present.escapeSignal);

  function handlePushOn() {
    dispatch({ t: 'PUSH_ON' });
  }

  function handleCallGetaway() {
    dispatch({ t: 'CALL_GETAWAY' });
  }

  return (
    <div data-testid="screen-offer">
      <h2>Offer</h2>

      {escapeSignal && (
        <p data-testid="escape-signal-hint">Getting hot — we can roll.</p>
      )}

      <button data-testid="btn-push-on" onClick={handlePushOn}>
        Push On
      </button>
      <button data-testid="btn-call-getaway" onClick={handleCallGetaway}>
        Call the Getaway
      </button>
    </div>
  );
}
