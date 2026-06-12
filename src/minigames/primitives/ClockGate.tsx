export interface ClockGateProps {
  /** What the GM should do before starting (read aloud, deal, brief the crew). */
  hint: string;
  /** CTA label. */
  label?: string;
  onStart: () => void;
}

/**
 * GM-controlled clock start (playtest wave 3): no timed game may auto-start —
 * the GM needs time to read the brief and explain the game without burning
 * the crew's clock. Render this INSTEAD of the timed challenge content; flip
 * a `clockStarted` flag in `onStart`.
 */
export function ClockGate({ hint, label = 'Start the clock', onStart }: ClockGateProps): JSX.Element {
  return (
    <div className="mg-clock-gate" data-testid="mg-clock-gate">
      <p className="mg-clock-gate__hint">{hint}</p>
      <button
        type="button"
        className="mg-call-outcome-btn"
        data-testid="mg-start-clock"
        onClick={onStart}
      >
        {label}
      </button>
    </div>
  );
}
