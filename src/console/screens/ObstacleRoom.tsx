import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { Teleprompter } from '@/console/teleprompter';
import type { ObstacleOption, PlayerId, Lane } from '@/engine';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_LANES = new Set<string>(['tech', 'physical', 'charm', 'stealth']);

function toLane(s: string | undefined): Lane | undefined {
  return s !== undefined && VALID_LANES.has(s) ? (s as Lane) : undefined;
}

// ── Option card ───────────────────────────────────────────────────────────────

interface OptionCardProps {
  option: ObstacleOption;
  selected: boolean;
  onSelect: () => void;
  narrationLine?: string | undefined;
}

function OptionCard({ option, selected, onSelect, narrationLine }: OptionCardProps) {
  return (
    <div data-testid={`option-card-${option.id}`} aria-selected={selected}>
      <button
        data-testid={`option-select-${option.id}`}
        onClick={onSelect}
        aria-pressed={selected}
      >
        {option.greedy ? 'Greedy' : 'Safe'}
      </button>
      {narrationLine !== undefined && narrationLine !== '' && (
        <span data-testid={`option-narration-${option.id}`}>{narrationLine}</span>
      )}
      <span data-testid={`option-game-${option.id}`} />
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
  const director = useGameStore(s => s.director);
  const dispatch = useGameStore(s => s.dispatch);

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [committed, setCommitted] = useState<Set<PlayerId>>(new Set());

  // Narration: clue and per-option descriptions picked once at mount.
  // RoomRouter guarantees room.kind === 'obstacle' when this component is mounted.
  const [clue, setClue] = useState<string>(() => {
    if (!director || !room || room.kind !== 'obstacle') return '';
    const tmpl = cfg.roomTemplates.obstacles.find(t => t.id === room.templateId);
    const laneCtx = toLane(tmpl?.lane);
    return director.next('obstacleClue', {
      gameId: room.options[0]?.gameId,
      ...(laneCtx !== undefined ? { lane: laneCtx } : {}),
    });
  });

  const [optionLines] = useState<Record<string, string>>(() => {
    if (!director || !room || room.kind !== 'obstacle') return {};
    const tmpl = cfg.roomTemplates.obstacles.find(t => t.id === room.templateId);
    const laneCtx = toLane(tmpl?.lane);
    const result: Record<string, string> = {};
    for (const opt of room.options) {
      result[opt.id] = director.next('optionDescription', {
        greedy: opt.greedy,
        ...(laneCtx !== undefined ? { lane: laneCtx } : {}),
      });
    }
    return result;
  });

  if (room === null || room.kind !== 'obstacle') return null;

  const template = cfg.roomTemplates.obstacles.find(t => t.id === room.templateId);
  const lane = template?.lane ?? room.templateId;
  const laneCtx = toLane(lane);

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
      committed: [...committed],
    });
  }

  function handleClueAdvance() {
    if (!director || room === null || room.kind !== 'obstacle') return;
    setClue(director.next('obstacleClue', {
      gameId: room.options[0]?.gameId,
      ...(laneCtx !== undefined ? { lane: laneCtx } : {}),
    }));
  }

  const commitCount = committed.size;
  const canCommit =
    selectedOptionId !== null && commitCount >= minCrew && commitCount <= maxCrew;

  return (
    <div data-testid="screen-room">
      <h2>Obstacle</h2>
      <p data-testid="obstacle-lane">Lane: {lane}</p>

      <Teleprompter line={clue} onAdvance={handleClueAdvance} />

      <div data-testid="option-cards">
        {room.options.map(option => (
          <OptionCard
            key={option.id}
            option={option}
            selected={option.id === selectedOptionId}
            narrationLine={optionLines[option.id]}
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
