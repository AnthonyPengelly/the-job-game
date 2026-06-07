import { ChevronRight, Megaphone } from 'lucide-react';

interface StageTeleprompterProps {
  line: string;
  onAdvance: () => void;
  amber?: boolean;
}

interface StageProps {
  /** Optional teleprompter line shown in the fixed strip at the top. */
  teleprompter?: StageTeleprompterProps;
  children: React.ReactNode;
}

/**
 * The cockpit centre stage.
 *
 * Has a fixed-height teleprompter strip at the top (never grows, never
 * pushes content) and a scrollable work area below. The document never
 * scrolls — only the work area does.
 */
export function Stage({ teleprompter, children }: StageProps) {
  return (
    <main className="cockpit-stage" data-testid="cockpit-stage">
      {teleprompter !== undefined && (
        <div
          className={`cockpit-tp${teleprompter.amber ? ' amber' : ''}`}
          data-testid="cockpit-tp"
        >
          <div className="tp-label">
            <Megaphone size={13} strokeWidth={1.75} aria-hidden="true" />
            Read aloud
          </div>
          <p>{teleprompter.line}</p>
          <button
            type="button"
            className="cockpit-tp-next"
            onClick={teleprompter.onAdvance}
            data-testid="cockpit-tp-next"
          >
            Next
            <ChevronRight size={12} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="cockpit-work" data-testid="cockpit-work">
        {children}
      </div>
    </main>
  );
}
