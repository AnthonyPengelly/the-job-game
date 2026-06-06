interface TeleprompterProps {
  /** The narration line to display. */
  line: string;
  /** Called when the GM presses the advance control to request the next line. */
  onAdvance: () => void;
}

/**
 * Dumb, reusable teleprompter presenter.
 *
 * Displays one narration line large and centred and provides an advance
 * control for the GM. It renders whatever line is handed to it — it does
 * not call the director; that is the screen's responsibility.
 *
 * The advance button is always enabled (no disabled dead-end).
 */
export function Teleprompter({ line, onAdvance }: TeleprompterProps) {
  return (
    <div data-testid="teleprompter" className="teleprompter">
      <p data-testid="teleprompter-line" className="teleprompter-text">
        {line}
      </p>
      <button
        data-testid="teleprompter-advance"
        className="teleprompter-advance"
        type="button"
        onClick={onAdvance}
      >
        Next
      </button>
    </div>
  );
}
