import { Megaphone } from 'lucide-react';

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
 * Styled with kit .teleprompter block: 3px accent left-rule, accent-tint
 * wash, t-teleprompter type (green-200 text, leading-relax).
 */
export function Teleprompter({ line, onAdvance }: TeleprompterProps) {
  return (
    <div data-testid="teleprompter" className="teleprompter">
      <div className="tp-label">
        <Megaphone size={13} strokeWidth={1.75} aria-hidden={true} />
        Read aloud
      </div>
      <p data-testid="teleprompter-line" className="t-teleprompter">
        {line}
      </p>
      <button
        data-testid="teleprompter-advance"
        className="btn btn-ghost"
        type="button"
        onClick={onAdvance}
      >
        Next
      </button>
    </div>
  );
}
