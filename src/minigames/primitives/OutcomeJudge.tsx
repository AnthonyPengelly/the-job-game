import { useState } from 'react';
import type { Outcome } from '@/engine';

/** What confirming a tier will do to the run — computed by the console host. */
export interface OutcomeConsequence {
  /** Full heat delta the engine will apply (drip + greedy surcharge + outcome heat). */
  heatDelta: number;
  /** Loot banked at this tier (raw loot units, pre-formatted by the host). */
  lootLabel: string;
  /** Gear note ("Gear drop kept" / "Gear drop lost"), absent when the option has no gear. */
  gearNote?: string;
}

export interface OutcomeJudgeProps {
  suggested: Outcome;
  onConfirm: (outcome: Outcome) => void;
  /**
   * Optional per-tier consequence preview (playtest wave 2: the confirm
   * screen is a moment, not three bare buttons). Rendered on the tier cards
   * when provided.
   */
  consequences?: Partial<Record<Outcome, OutcomeConsequence>>;
}

const OUTCOME_LABELS: Record<Outcome, string> = {
  clean: 'Clean',
  complication: 'Complication',
  botched: 'Botched',
};

const OUTCOME_TAGLINES: Record<Outcome, string> = {
  clean: 'Textbook. Full take.',
  complication: 'Scraped it — the comedic middle.',
  botched: 'The room won this one.',
};

const OUTCOMES: Outcome[] = ['clean', 'complication', 'botched'];

function deltaLabel(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/**
 * The outcome-confirm moment: three big tier cards (clean / complication /
 * botched) pre-selected to `judge`'s suggestion, each previewing what
 * confirming it does — heat, loot, gear. The GM's tap is authoritative — the
 * app never overrides (the-job-app-design.md §10.4); the comedic middle stays
 * one tap away.
 */
export function OutcomeJudge({ suggested, onConfirm, consequences }: OutcomeJudgeProps): JSX.Element {
  const [selected, setSelected] = useState<Outcome>(suggested);

  function handleSelect(outcome: Outcome) {
    setSelected(outcome);
  }

  function handleConfirm() {
    onConfirm(selected);
  }

  return (
    <div data-testid="outcome-judge" className="oj">
      <div className="oj-head">
        <span className="oj-eyebrow">Call the room</span>
        <span className="oj-sub">
          The app suggests <b>{OUTCOME_LABELS[suggested]}</b> — your call is final.
        </span>
      </div>
      <div data-testid="outcome-options" className="oj-cards">
        {OUTCOMES.map((o) => {
          const cons = consequences?.[o];
          const isSelected = selected === o;
          const isSuggested = suggested === o;
          return (
            <button
              key={o}
              type="button"
              data-testid={`outcome-option-${o}`}
              data-selected={isSelected ? 'true' : 'false'}
              className={`oj-card oj-card--${o}${isSelected ? ' selected' : ''}`}
              onClick={() => handleSelect(o)}
              style={{ fontWeight: isSelected ? 'bold' : 'normal' }}
            >
              {isSuggested && (
                <span className="oj-suggested" data-testid={`outcome-suggested-${o}`}>
                  App suggests
                </span>
              )}
              <span className="oj-card-title">{OUTCOME_LABELS[o]}</span>
              <span className="oj-card-tag">{OUTCOME_TAGLINES[o]}</span>
              {cons !== undefined && (
                <span className="oj-consq" data-testid={`outcome-consq-${o}`}>
                  <span className="oj-c">
                    <span className="oj-ck">Heat</span>
                    <span className="oj-cv heat">{deltaLabel(cons.heatDelta)}</span>
                  </span>
                  <span className="oj-c">
                    <span className="oj-ck">Loot</span>
                    <span className="oj-cv loot">{cons.lootLabel}</span>
                  </span>
                  {cons.gearNote !== undefined && (
                    <span className="oj-c">
                      <span className="oj-ck">Gear</span>
                      <span className="oj-cv">{cons.gearNote}</span>
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button data-testid="outcome-confirm" className="oj-confirm" onClick={handleConfirm}>
        Confirm {OUTCOME_LABELS[selected]}
      </button>
    </div>
  );
}
