import { useState, useEffect } from 'react';
import { Flame, Shield } from 'lucide-react';
import { useGameStore } from '@/console/store';
import { PhaseHead, Panel, ActionBar, Button } from '@/console/ui';
import { Teleprompter } from '@/console/teleprompter';
import { useCrewRailMode } from '@/console/shell';
import { formatLoot } from '@/content/format';
import type { ObstacleOption, Lane } from '@/engine';

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
    <div
      data-testid={`option-card-${option.id}`}
      aria-selected={selected}
      className={`opt ${option.greedy ? 'risk' : 'safe'}${selected ? ' selected' : ''}`}
    >
      <span className="opt-tag">
        {option.greedy ? (
          <>
            <Flame size={13} strokeWidth={1.75} aria-hidden />
            {' '}High risk
          </>
        ) : (
          <>
            <Shield size={13} strokeWidth={1.75} aria-hidden />
            {' '}Play it safe
          </>
        )}
      </span>
      <h4>{option.greedy ? 'Greedy' : 'Safe'}</h4>
      {narrationLine !== undefined && narrationLine !== '' && (
        <p className="prose muted" data-testid={`option-narration-${option.id}`}>
          {narrationLine}
        </p>
      )}
      <span data-testid={`option-game-${option.id}`} />
      <div className="opt-cost">
        <div className="c">
          <span className="k">Loot</span>
          <span
            data-testid={`option-reward-${option.id}`}
            className="v"
            style={option.reward > 0 ? { color: 'var(--accent)' } : undefined}
          >
            {option.gear ? (
              option.reward > 0 ? (
                <>{formatLoot(option.reward)}<span className="gpill">+ Gear</span></>
              ) : (
                <span className="gpill">Gear only</span>
              )
            ) : (
              formatLoot(option.reward)
            )}
          </span>
        </div>
        <div className="c">
          <span className="k">Heat</span>
          <span
            data-testid={`option-heat-${option.id}`}
            className="v"
            style={{ color: 'var(--danger)' }}
          >
            {option.heatCost}
          </span>
        </div>
      </div>
      <button
        data-testid={`option-select-${option.id}`}
        onClick={onSelect}
        aria-pressed={selected}
        className={`btn ${selected ? 'btn-primary' : 'btn-secondary'}`}
        type="button"
      >
        {selected ? 'Selected' : option.greedy ? 'Go greedy' : 'Play safe'}
      </button>
    </div>
  );
}

// ── Obstacle room screen ──────────────────────────────────────────────────────

/**
 * GM console screen for obstacle rooms (phase='room', currentRoom.kind='obstacle').
 * Shows the lane clue, both option cards, and a crew-commit control.
 * Committing dispatches CHOOSE_OPTION, advancing the engine to the minigame phase.
 *
 * Commit selection is driven through CrewRailModeContext (E13.8): selecting an
 * option activates commit mode on the crew rail and this screen reads back the
 * committed set from the shared context.
 *
 * Narration: entry roomApproach lines are prepended to obstacleClue lines so the
 * GM reads the scene-set first, then the choice prompt. Next steps through the
 * committed sequence and disappears at the last line.
 */
export function ObstacleRoom() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const crew = useGameStore(s => s.session.present.crew);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const cfg = useGameStore(s => s.cfg);
  const director = useGameStore(s => s.director);
  const dispatch = useGameStore(s => s.dispatch);

  const {
    committed,
    minCommit,
    maxCommit,
    toggleCommit,
    activateCommit,
    deactivate,
  } = useCrewRailMode();

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const crewNames = crew.map(p => p.name).join(', ');
  const roomNum = String(roomIndex + 1).padStart(2, '0');

  // Entry → tension narration: roomApproach (scene-set) prepended to obstacleClue.
  // Committed once at mount; stepping through the sequence is handled locally.
  const [lines] = useState<string[]>(() => {
    if (!director || !room || room.kind !== 'obstacle') return [];
    const tmpl = cfg.roomTemplates.obstacles.find(t => t.id === room.templateId);
    const laneCtx = toLane(tmpl?.lane);
    const approachCtx = {
      roomNum,
      crew: crewNames,
      ...(laneCtx !== undefined ? { lane: laneCtx } : {}),
    };
    const clueCtx = {
      gameId: room.options[0]?.gameId,
      roomNum,
      crew: crewNames,
      ...(laneCtx !== undefined ? { lane: laneCtx } : {}),
    };
    return [
      ...director.script('roomApproach', approachCtx),
      ...director.script('obstacleClue', clueCtx),
    ];
  });
  const [lineIndex, setLineIndex] = useState(0);

  // Per-option description lines, committed once at mount.
  const [optionLines] = useState<Record<string, string>>(() => {
    if (!director || !room || room.kind !== 'obstacle') return {};
    const tmpl = cfg.roomTemplates.obstacles.find(t => t.id === room.templateId);
    const laneCtx = toLane(tmpl?.lane);
    const result: Record<string, string> = {};
    for (const opt of room.options) {
      const optLines = director.script('optionDescription', {
        greedy: opt.greedy,
        ...(laneCtx !== undefined ? { lane: laneCtx } : {}),
      });
      result[opt.id] = optLines[0] ?? '';
    }
    return result;
  });

  // Deactivate crew rail commit mode when this screen unmounts.
  useEffect(() => {
    return () => { deactivate(); };
  }, [deactivate]);

  if (room === null || room.kind !== 'obstacle') return null;

  const template = cfg.roomTemplates.obstacles.find(t => t.id === room.templateId);
  const lane = template?.lane ?? room.templateId;

  function handleSelectOption(option: ObstacleOption) {
    const [min, max] = option.commitRange ?? [1, Math.max(1, crew.length)];
    setSelectedOptionId(option.id);
    activateCommit(min, max);
  }

  function handleCommit() {
    if (selectedOptionId === null) return;
    dispatch({
      t: 'CHOOSE_OPTION',
      optionId: selectedOptionId,
      committed: [...committed],
    });
  }

  function handleAdvance() {
    setLineIndex(i => Math.min(i + 1, lines.length - 1));
  }

  const currentLine = lines[lineIndex] ?? '';
  const hasNext = lineIndex < lines.length - 1;

  const commitCount = committed.size;
  const canCommit =
    selectedOptionId !== null && commitCount >= minCommit && commitCount <= maxCommit;

  return (
    <div className="stage-inner" data-testid="screen-room">
      <PhaseHead
        eyebrow={`Room ${roomNum} A · Obstacle`}
        title={lane.charAt(0).toUpperCase() + lane.slice(1)}
        aside={
          <span data-testid="obstacle-lane">Lane: {lane}</span>
        }
      />

      <Teleprompter line={currentLine} hasNext={hasNext} onAdvance={handleAdvance} />

      <div className="grid-2" data-testid="option-cards">
        {room.options.map(option => (
          <OptionCard
            key={option.id}
            option={option}
            selected={option.id === selectedOptionId}
            narrationLine={optionLines[option.id]}
            onSelect={() => handleSelectOption(option)}
          />
        ))}
      </div>

      {selectedOptionId !== null && (
        <Panel live title="Crew" tag={`Commit ${minCommit}–${maxCommit}`}>
          <div data-testid="crew-commit">
            <p data-testid="commit-range">
              Commit {minCommit}–{maxCommit} crew ({commitCount} selected)
            </p>
            {crew.map(player => (
              <label key={player.id} data-testid={`crew-label-${player.id}`}>
                <input
                  type="checkbox"
                  data-testid={`crew-checkbox-${player.id}`}
                  checked={committed.has(player.id)}
                  onChange={() => toggleCommit(player.id)}
                  disabled={!committed.has(player.id) && commitCount >= maxCommit}
                />
                {player.name}
              </label>
            ))}
          </div>
        </Panel>
      )}

      <ActionBar
        right={
          <Button
            kind="primary"
            data-testid="btn-commit"
            onClick={handleCommit}
            disabled={!canCommit}
          >
            Commit
          </Button>
        }
      />
    </div>
  );
}
