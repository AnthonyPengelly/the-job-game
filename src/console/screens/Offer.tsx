import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { Teleprompter } from '@/console/teleprompter';
import type { EngineConfig } from '@/engine';

// ── Heat band derivation ──────────────────────────────────────────────────────

type HeatBand = 'cool' | 'warm' | 'hot';

function deriveHeatBand(heat: number, cfg: EngineConfig): HeatBand {
  const runAtThreshold = cfg.heat.hMax * cfg.heat.runAtFraction;
  if (heat < runAtThreshold) return 'cool';
  if (heat < cfg.heat.hMax * 0.75) return 'warm';
  return 'hot';
}

// ── Offer screen ──────────────────────────────────────────────────────────────

/**
 * GM console screen for the offer phase.
 *
 * "Push on" → PUSH_ON (engine advances to the next room, or routes to getaway
 * if heat ≥ HMAX — the forced-getaway path is handled entirely in the reducer).
 * "Call the Getaway" → CALL_GETAWAY (immediately enters getaway phase).
 *
 * The escape-signal hint ("getting hot — we can roll") is shown exactly when
 * state.escapeSignal is true (heat is at or above the run-at fraction).
 *
 * The pushRun teleprompter surfaces a director-selected line scoped by heatBand
 * derived from current Heat vs the escape signal threshold.
 */
export function Offer() {
  const dispatch = useGameStore(s => s.dispatch);
  const escapeSignal = useGameStore(s => s.session.present.escapeSignal);
  const heat = useGameStore(s => s.session.present.heat);
  const cfg = useGameStore(s => s.cfg);
  const director = useGameStore(s => s.director);

  const [pushRunLine, setPushRunLine] = useState<string>(() => {
    if (!director) return '';
    return director.next('pushRun', { heatBand: deriveHeatBand(heat, cfg) });
  });

  function handlePushOn() {
    dispatch({ t: 'PUSH_ON' });
  }

  function handleCallGetaway() {
    dispatch({ t: 'CALL_GETAWAY' });
  }

  function handleAdvance() {
    if (!director) return;
    setPushRunLine(director.next('pushRun', { heatBand: deriveHeatBand(heat, cfg) }));
  }

  return (
    <div data-testid="screen-offer">
      <h2>Offer</h2>

      {pushRunLine !== '' && (
        <div data-testid="push-run-narration">
          <Teleprompter line={pushRunLine} onAdvance={handleAdvance} />
        </div>
      )}

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
