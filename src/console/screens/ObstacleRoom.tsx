import { useState } from 'react';
import { useGameStore } from '@/console/store';
import type { ObstacleOption, PlayerId } from '@/engine';

// ── Option card ───────────────────────────────────────────────────────────────

interface OptionCardProps {
  option: ObstacleOption;
  selected: boolean;
  onSelect: () => void;
}

function OptionCard({ option, selected, onSelect }: OptionCardProps) {
  return (
    <div data-testid={`option-card-${option.id}`} aria-selected={selected}>
      <button
        data-testid={`option-select-${option.id}`}
        onClick={onSelect}
        aria-pressed={selected}
      >
        {option.greedy ? 'Greedy' : 'Safe'}
      </button>
      <span data-testid={`option-game-${option.id}`}>{option.gameId}</span>
      <span data-testid={`option-reward-${option.id}`}>Loot: {option.reward}</span>
      <span data-testid={`option-heat-${option.id}`}>Heat: {option.heatCost}</span>
    </div>
  );
}

// ── Obstacle room screen ──────────────────────────────────────────────────────

/**
 * GM console screen for obstacle rooms (phase='room', currentRoom.kind='obstacle').
 * Shows the lane clue, both option cards, and a crew-commit control.
 * Committing dispatches CHOOSE_OPTION, advancing the engine to the minigame phase.
 */
export function ObstacleRoom() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const crew = useGameStore(s => s.session.present.crew);
  const cfg = useGameStore(s => s.cfg);
  const dispatch = useGameStore(s => s.dispatch);

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [committed, setCommitted] = useState<Set<PlayerId>>(new Set());

  if (room === null || room.kind !== 'obstacle') return null;

  const template = cfg.roomTemplates.obstacles.find(t => t.id === room.templateId);
  const lane = template?.lane ?? room.templateId;

  const selectedOption = room.options.find(o => o.id === selectedOptionId);
  const [minCrew, maxCrew] = selectedOption?.commitRange ?? [1, Math.max(1, crew.length)];

  function toggleCrewMember(id: PlayerId) {
    setCommitted(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxCrew) {
        next.add(id);
      }
      return next;
    });
  }

  function handleCommit() {
    if (selectedOptionId === null) return;
    dispatch({
      t: 'CHOOSE_OPTION',
      optionId: selectedOptionId,
      committed: [...committed] as PlayerId[],
    });
  }

  const commitCount = committed.size;
  const canCommit =
    selectedOptionId !== null && commitCount >= minCrew && commitCount <= maxCrew;

  return (
    <div data-testid="screen-room">
      <h2>Obstacle</h2>
      <p data-testid="obstacle-lane">Lane: {lane}</p>

      <div data-testid="option-cards">
        {room.options.map(option => (
          <OptionCard
            key={option.id}
            option={option}
            selected={option.id === selectedOptionId}
            onSelect={() => {
              setSelectedOptionId(option.id);
              setCommitted(new Set());
            }}
          />
        ))}
      </div>

      {selectedOptionId !== null && (
        <div data-testid="crew-commit">
          <p data-testid="commit-range">
            Commit {minCrew}–{maxCrew} crew ({commitCount} selected)
          </p>
          {crew.map(player => (
            <label key={player.id} data-testid={`crew-label-${player.id}`}>
              <input
                type="checkbox"
                data-testid={`crew-checkbox-${player.id}`}
                checked={committed.has(player.id)}
                onChange={() => toggleCrewMember(player.id)}
                disabled={!committed.has(player.id) && commitCount >= maxCrew}
              />
              {player.name}
            </label>
          ))}
        </div>
      )}

      <button data-testid="btn-commit" onClick={handleCommit} disabled={!canCommit}>
        Commit
      </button>
    </div>
  );
}
