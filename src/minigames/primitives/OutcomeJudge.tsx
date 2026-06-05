import { useState } from 'react';
import type { Outcome } from '@/engine';

export interface OutcomeJudgeProps {
  suggested: Outcome;
  onConfirm: (outcome: Outcome) => void;
}

const OUTCOME_LABELS: Record<Outcome, string> = {
  clean: 'Clean',
  complication: 'Complication',
  botched: 'Botched',
};

const OUTCOMES: Outcome[] = ['clean', 'complication', 'botched'];

/**
 * Clean/complication/botched control pre-set to the suggested tier.
 * The comedic middle is one tap away. The GM's tap is authoritative — the app never overrides.
 * (the-job-app-design.md §10.4)
 */
export function OutcomeJudge({ suggested, onConfirm }: OutcomeJudgeProps): JSX.Element {
  const [selected, setSelected] = useState<Outcome>(suggested);

  function handleSelect(outcome: Outcome) {
    setSelected(outcome);
  }

  function handleConfirm() {
    onConfirm(selected);
  }

  return (
    <div data-testid="outcome-judge">
      <div data-testid="outcome-options" style={{ display: 'flex', gap: 8 }}>
        {OUTCOMES.map((o) => (
          <button
            key={o}
            data-testid={`outcome-option-${o}`}
            data-selected={selected === o ? 'true' : 'false'}
            onClick={() => handleSelect(o)}
            style={{ fontWeight: selected === o ? 'bold' : 'normal' }}
          >
            {OUTCOME_LABELS[o]}
          </button>
        ))}
      </div>
      <button data-testid="outcome-confirm" onClick={handleConfirm}>
        Confirm {OUTCOME_LABELS[selected]}
      </button>
    </div>
  );
}
