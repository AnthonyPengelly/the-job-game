import { useState } from 'react';
import { useGameStore } from '@/console/store';
import type { ScenarioChoice } from '@/engine';

// ── Stage-one choice card ─────────────────────────────────────────────────────

interface ChoiceCardProps {
  choice: ScenarioChoice;
  onSelect: () => void;
}

function ChoiceCard({ choice, onSelect }: ChoiceCardProps) {
  return (
    <div data-testid={`choice-card-${choice.id}`}>
      <button data-testid={`btn-choice-${choice.id}`} onClick={onSelect}>
        {choice.label}
      </button>
    </div>
  );
}

// ── Scenario room screen ──────────────────────────────────────────────────────

/**
 * GM console screen for scenario rooms (phase='room', currentRoom.kind='scenario').
 *
 * Two-stage stub:
 *   Stage one  — both choice labels shown as flavour only; no heat/loot numbers
 *                (opaque-to-commit rule, design §10.3).
 *   Stage two  — the chosen label is revealed and confirmed; dispatches
 *                CHOOSE_SCENARIO { choiceId } advancing the engine to Offer.
 *
 * attemptedBy (E7 attempter flow) is intentionally unused here.
 */
export function ScenarioRoom() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const dispatch = useGameStore(s => s.dispatch);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (room === null || room.kind !== 'scenario') return null;

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  function handleConfirm() {
    if (selectedId === null) return;
    dispatch({ t: 'CHOOSE_SCENARIO', choiceId: selectedId });
  }

  if (selectedId === null) {
    return (
      <div data-testid="screen-room">
        <h2>Scenario</h2>
        <div data-testid="scenario-choices">
          {room.choices.map(choice => (
            <ChoiceCard
              key={choice.id}
              choice={choice}
              onSelect={() => handleSelect(choice.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  const confirmedChoice = room.choices.find(c => c.id === selectedId)!;

  return (
    <div data-testid="screen-room">
      <h2>Scenario</h2>
      <div data-testid="confirmed-choice">
        <span data-testid="confirmed-label">{confirmedChoice.label}</span>
      </div>
      <button data-testid="btn-confirm" onClick={handleConfirm}>
        Confirm
      </button>
    </div>
  );
}
