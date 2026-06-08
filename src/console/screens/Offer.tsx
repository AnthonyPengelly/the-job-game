import { useState, useEffect, useRef } from 'react';
import { Flame, Shield, Zap } from 'lucide-react';
import { useGameStore } from '@/console/store';
import { Teleprompter } from '@/console/teleprompter';
import { PhaseHead, Icon } from '@/console/ui';
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

  // Guard ensures director.next() fires exactly once even under React StrictMode,
  // which double-invokes useState lazy initializers in development.
  const hasPicked = useRef(false);
  const [pushRunLine, setPushRunLine] = useState<string>('');
  useEffect(() => {
    if (hasPicked.current || !director) return;
    hasPicked.current = true;
    setPushRunLine(director.next('pushRun', { heatBand: deriveHeatBand(heat, cfg) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div data-testid="screen-offer" className="stage-inner">
      <PhaseHead
        eyebrow="04 · The Offer"
        title="The Fence"
        aside="A choice · No take-backs"
      />

      {pushRunLine !== '' && (
        <div data-testid="push-run-narration">
          <Teleprompter line={pushRunLine} onAdvance={handleAdvance} />
        </div>
      )}

      {escapeSignal && (
        <div
          data-testid="escape-signal-hint"
          className="cockpit-escape-sig"
        >
          <Zap size={18} strokeWidth={1.75} aria-hidden />
          <div className="t">
            <span className="k">Escape signal</span>
            <span className="v">Getting hot — we can roll.</span>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div
          className="opt risk"
          role="button"
          tabIndex={0}
          data-testid="btn-push-on"
          onClick={handlePushOn}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePushOn(); }}
        >
          <span className="opt-tag">
            <Icon icon={Flame} size={14} />
            {' '}High risk
          </span>
          <h4>Push On</h4>
          <p className="prose muted" style={{ fontSize: 16 }}>
            Take another room. More exposure, more reward.
          </p>
          <div className="opt-cost">
            <div className="c">
              <span className="k">Next room</span>
              <span className="v" style={{ color: 'var(--danger)' }}>+Heat</span>
            </div>
          </div>
        </div>

        <div
          className={`opt${escapeSignal ? ' risk' : ' safe'}`}
          role="button"
          tabIndex={0}
          data-testid="btn-call-getaway"
          onClick={handleCallGetaway}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCallGetaway(); }}
          style={escapeSignal ? { borderColor: 'var(--caution)', boxShadow: '0 0 0 1px var(--caution)' } : undefined}
        >
          <span className="opt-tag" style={escapeSignal ? { color: 'var(--caution)' } : undefined}>
            <Icon icon={escapeSignal ? Zap : Shield} size={14} />
            {' '}{escapeSignal ? 'Escape signal' : 'Play it safe'}
          </span>
          <h4>Call the Getaway</h4>
          <p className="prose muted" style={{ fontSize: 16 }}>
            Bank what you have. Live to spend it.
          </p>
          <div className="opt-cost">
            <div className="c">
              <span className="k">Heat</span>
              <span className="v" style={{ color: 'var(--fg-faint)' }}>±0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
