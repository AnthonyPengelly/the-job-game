import { Megaphone } from 'lucide-react';

interface TeleprompterProps {
  /** The narration line to display. */
  line: string;
  /**
   * When true the Next button is rendered; when false it is absent entirely.
   * There is no disabled state — no next line means no control (no dead-end).
   */
  hasNext: boolean;
  /** Called when the GM presses the advance control to step to the next line. */
  onAdvance: () => void;
}

/**
 * Dumb, reusable teleprompter presenter.
 *
 * Displays one narration line large and centred and — when `hasNext` is true —
 * provides an advance control for the GM to step to the next committed line.
 * It renders whatever line is handed to it; it does not call the director.
 *
 * The Next button only renders when there is a next line (`hasNext === true`).
 * When the last line is reached the button is absent (no disabled dead-end).
 * Styled with kit .teleprompter block: 3px accent left-rule, accent-tint
 * wash, t-teleprompter type (green-200 text, leading-relax).
 */
export function Teleprompter({ line, hasNext, onAdvance }: TeleprompterProps) {
  return (
    <div data-testid="teleprompter" className="teleprompter">
      <div className="tp-label">
        <Megaphone size={13} strokeWidth={1.75} aria-hidden={true} />
        Read aloud
      </div>
      <p data-testid="teleprompter-line" className="t-teleprompter">
        {line}
      </p>
      {hasNext && (
        <button
          data-testid="teleprompter-advance"
          className="btn btn-ghost"
          type="button"
          onClick={onAdvance}
        >
          Next
        </button>
      )}
    </div>
  );
}
