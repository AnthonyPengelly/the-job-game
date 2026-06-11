import { useState, useEffect, useMemo } from 'react';
import { Check, Flame, Shield, Users } from 'lucide-react';
import { useGameStore } from '@/console/store';
import { ActionBar, Button } from '@/console/ui';
import { PhaseHead } from '@/console/ui';
import { Teleprompter } from '@/console/teleprompter';
import { useCrewRailMode } from '@/console/shell';
import { formatLoot } from '@/content/format';
import { buildRegistry } from '@/minigames';
import { computeDial, restRoomsFor } from '@/engine';
import type { ObstacleOption, Lane } from '@/engine';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_LANES = new Set<string>(['tech', 'physical', 'charm', 'stealth']);

function toLane(s: string | undefined): Lane | undefined {
  return s !== undefined && VALID_LANES.has(s) ? (s as Lane) : undefined;
}

function laneName(lane: string): string {
  return lane.charAt(0).toUpperCase() + lane.slice(1);
}

/** "Physical + Stealth" for a combo, "Physical" for a single-lane game. */
function lanesLabel(lanes: readonly string[]): string {
  return lanes.map(laneName).join(' + ');
}

// ── Option card ───────────────────────────────────────────────────────────────

interface OptionCardProps {
  option: ObstacleOption;
  /** All lanes of the bound game (registry truth) — both lanes for a combo. */
  gameLanes: readonly string[];
  gameName: string;
  selected: boolean;
  onSelect: () => void;
  narrationLine?: string | undefined;
  dialLevel?: number | undefined;
  /** Dial level with nobody committed — the live preview shows the stats delta against this. */
  dialBaseline?: number | undefined;
}

function OptionCard({
  option,
  gameLanes,
  gameName,
  selected,
  onSelect,
  narrationLine,
  dialLevel,
  dialBaseline,
}: OptionCardProps) {
  const tagContent = selected ? (
    <>
      <Check size={13} strokeWidth={1.75} aria-hidden />
      {' '}Selected door
    </>
  ) : option.greedy ? (
    <>
      <Flame size={13} strokeWidth={1.75} aria-hidden />
      {' '}High risk
    </>
  ) : (
    <>
      <Shield size={13} strokeWidth={1.75} aria-hidden />
      {' '}Safe line
    </>
  );

  const fillPct = dialLevel !== undefined
    ? Math.min(100, Math.max(0, (dialLevel / 2.0) * 100))
    : 50;

  // How the committed crew's stats move the dial vs an empty commit. Negative
  // = the specialists are easing the game; this is the "send your strongest"
  // feedback moment, so it gets called out explicitly.
  const statDelta =
    dialLevel !== undefined && dialBaseline !== undefined ? dialLevel - dialBaseline : undefined;

  const dialWord =
    dialLevel === undefined ? '' :
    dialLevel <= 0 ? 'cruisy' :
    dialLevel <= 0.75 ? 'steady' :
    dialLevel <= 1.5 ? 'tense' : 'brutal';

  return (
    <div
      data-testid={`option-card-${option.id}`}
      aria-selected={selected}
      className={`opt ${option.greedy ? 'risk' : 'safe'}${selected ? ' selected' : ''}`}
      onClick={selected ? undefined : onSelect}
    >
      <span className="opt-tag">{tagContent}</span>
      <h4>{option.greedy ? 'Greedy' : 'Safe'}</h4>
      <div
        className="game"
        data-testid={`option-game-${option.id}`}
      >
        <span className="lanechip" data-testid={`option-lane-chip-${option.id}`}>
          {lanesLabel(gameLanes)}
        </span>
        <span className="gn" data-testid={`option-game-name-${option.id}`}>
          {gameName}
        </span>
      </div>
      {narrationLine !== undefined && narrationLine !== '' && (
        <p className="desc" data-testid={`option-narration-${option.id}`}>
          {narrationLine}
        </p>
      )}
      {selected && dialLevel !== undefined && (
        <div className="dialbar" data-testid="option-dial" aria-label="GM-only difficulty dial">
          <span className="dlabel">Difficulty dial · GM only</span>
          <div className="dtrack">
            <div className="dfill" style={{ width: `${fillPct}%` }} />
          </div>
          <span className="dval" data-testid="option-dial-value">
            {dialLevel.toFixed(1)} · {dialWord}
          </span>
          {statDelta !== undefined && statDelta < -0.05 && (
            <span className="ddelta ddelta--ease" data-testid="option-dial-delta">
              crew stats ease it {statDelta.toFixed(1)}
            </span>
          )}
        </div>
      )}
      <div className="opt-cost">
        <div className="c">
          <span className="k">Reward</span>
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
      {!selected && (
        <button
          data-testid={`option-select-${option.id}`}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          aria-pressed={selected}
          className="btn btn-secondary"
          type="button"
        >
          {option.greedy ? 'Go greedy' : 'Play safe'}
        </button>
      )}
    </div>
  );
}

// ── Obstacle room screen ──────────────────────────────────────────────────────

/**
 * GM console screen for obstacle rooms (phase='room', currentRoom.kind='obstacle').
 * Shows the lane clue, both option cards, and a crew-commit control.
 * Committing dispatches CHOOSE_OPTION, advancing the engine to the minigame phase.
 *
 * Commit selection is driven through CrewRailModeContext (E13.8/E19.2): selecting an
 * option activates commit mode on the crew rail and this screen reads back the
 * committed set from the shared context. The in-stage checkbox panel was removed in
 * E19.3 — crew are tapped on the left rail to commit them.
 *
 * Narration: entry roomApproach lines are prepended to obstacleClue lines so the
 * GM reads the scene-set first, then the choice prompt. Next steps through the
 * committed sequence and disappears at the last line.
 */
export function ObstacleRoom() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const crew = useGameStore(s => s.session.present.crew);
  const heat = useGameStore(s => s.session.present.heat);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const cfg = useGameStore(s => s.cfg);
  const director = useGameStore(s => s.director);
  const dispatch = useGameStore(s => s.dispatch);

  const {
    committed,
    minCommit,
    maxCommit,
    activateCommit,
    activateFullTeam,
    deactivate,
  } = useCrewRailMode();

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const crewNames = crew.map(p => p.name).join(', ');
  const roomNum = String(roomIndex + 1).padStart(2, '0');

  // Whether committing benches a player next room at this headcount. At 2–3
  // players the exhaustion class is "tired" (restRooms=0) — promising "whoever
  // plays rests next room" would be a lie the table catches immediately.
  const restsApply = restRoomsFor(crew.length, cfg) > 0;

  // Build the minigame registry once (keyed by gameId) for name lookups.
  const registry = useMemo(() => buildRegistry(cfg), [cfg]);

  // Per-option game name: look up in registry, fall back to gameId.
  function resolveGameName(gameId: string): string {
    const game = registry.find(g => g.id === gameId);
    return game?.name ?? gameId;
  }

  // Entry → tension narration: roomApproach (scene-set) prepended to obstacleClue.
  const [lines] = useState<string[]>(() => {
    if (!director || !room || room.kind !== 'obstacle') return [];
    const tmpl = cfg.roomTemplates.obstacles.find(t => t.id === room.templateId);
    const laneCtx = toLane(tmpl?.lane);
    const approachCtx = {
      roomNum,
      crew: crewNames,
      restsApply,
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

  // Derive selected option before early return (needed for useMemo below).
  const obstacleOptions = room?.kind === 'obstacle' ? room.options : [];
  const selectedOption = selectedOptionId !== null
    ? obstacleOptions.find(o => o.id === selectedOptionId)
    : undefined;

  // Compute the GM-only difficulty dial for the selected option.
  // Updates live as crew are tapped on the rail. Must be called before any early return.
  const dialPreview = useMemo((): { level: number; baseline: number } | undefined => {
    if (selectedOptionId === null || selectedOption === undefined) return undefined;
    const game = registry.find(g => g.id === selectedOption.gameId);
    if (game === undefined) return undefined;
    const committedPlayers = crew.filter(p => committed.has(p.id));
    const laneRatings = committedPlayers.flatMap(p =>
      game.lanes.map(lane => p.stats[lane]),
    );
    const ctx = { heat, roomIndex };
    return {
      level: computeDial(laneRatings, selectedOption.gameId, crew.length, cfg, ctx),
      // Baseline: same option, nobody committed — the delta is what the
      // committed crew's stats are worth, shown live as players are tapped.
      baseline: computeDial([], selectedOption.gameId, crew.length, cfg, ctx),
    };
  }, [selectedOptionId, selectedOption, registry, committed, crew, cfg, heat, roomIndex]);
  const dialLevel = dialPreview?.level;

  if (room === null || room.kind !== 'obstacle') return null;

  const template = cfg.roomTemplates.obstacles.find(t => t.id === room.templateId);
  const templateLane = template?.lane ?? room.templateId;
  // Lane display follows the bound game's lanes (registry truth) — a combo game
  // shows both lanes, not just the template's nominal single lane.
  const roomGame = registry.find(g => g.id === room.options[0]?.gameId);
  const gameLanes: readonly string[] = roomGame?.lanes ?? [templateLane];
  const laneLabelFull = lanesLabel(gameLanes);

  const isFullTeam = selectedOption?.fullTeam === true;

  function handleSelectOption(option: ObstacleOption) {
    setSelectedOptionId(option.id);
    if (option.fullTeam === true) {
      activateFullTeam(crew.map(p => p.id));
    } else {
      const [min, max] = option.commitRange ?? [1, Math.max(1, crew.length)];
      activateCommit(min, max);
    }
  }

  function handleChangeOption() {
    setSelectedOptionId(null);
    deactivate();
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

  // Players committed in order (for chip row).
  const committedPlayers = crew.filter(p => committed.has(p.id));

  return (
    <div className="stage-inner" data-testid="screen-room">
      <PhaseHead
        eyebrow={`Room ${roomNum} A · Obstacle`}
        title={laneLabelFull}
        aside={
          <span data-testid="obstacle-lane">
            {gameLanes.length > 1 ? 'Lanes' : 'Lane'}: {gameLanes.join(' + ')}
          </span>
        }
      />

      <Teleprompter line={currentLine} hasNext={hasNext} onAdvance={handleAdvance} />

      {selectedOptionId === null ? (
        /* ── Pre-selection: option grid ── */
        <div className="opts" data-testid="option-cards">
          {room.options.map(option => (
            <OptionCard
              key={option.id}
              option={option}
              gameLanes={gameLanes}
              gameName={resolveGameName(option.gameId)}
              selected={false}
              onSelect={() => handleSelectOption(option)}
              narrationLine={optionLines[option.id]}
            />
          ))}
        </div>
      ) : (
        /* ── Post-selection: two-column commit layout ── */
        <div className="commit" data-testid="commit-layout">
          {/* Selected door card */}
          <OptionCard
            option={room.options.find(o => o.id === selectedOptionId)!}
            gameLanes={gameLanes}
            gameName={resolveGameName(room.options.find(o => o.id === selectedOptionId)!.gameId)}
            selected={true}
            onSelect={() => { /* no-op: already selected */ }}
            narrationLine={optionLines[selectedOptionId]}
            dialLevel={dialLevel}
            dialBaseline={dialPreview?.baseline}
          />

          {/* Commit side-panel */}
          <div className="commit-side" data-testid="commit-side">
            <div className="commit-instruct">
              <span className="ci-k">
                <Users size={15} aria-hidden /> Commit the crew
              </span>
              {isFullTeam ? (
                <p data-testid="crew-full-team">
                  This is a full-team game — the whole crew plays and{' '}
                  <b>no one rests</b> afterward.
                </p>
              ) : (
                <p>
                  This is a <b>{laneLabelFull}</b> room — tap{' '}
                  {minCommit === maxCommit ? minCommit : `${minCommit}–${maxCommit}`} on
                  the left rail to send them in.
                  {restsApply ? (
                    <> Whoever plays <b>rests next room</b>.</>
                  ) : (
                    <> Small crew — <b>no one rests</b>; everyone stays in play.</>
                  )}
                </p>
              )}
            </div>

            <div className="committed" data-testid="committed-panel">
              <span className="ch" data-testid="commit-going-in">
                Going in · {commitCount} of {maxCommit}
              </span>
              <div className="commchips" data-testid="commchips">
                {committedPlayers.map(player => (
                  <div
                    key={player.id}
                    className="commchip"
                    data-testid={`commchip-${player.id}`}
                  >
                    <span className="av">
                      {player.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="nm">{player.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ActionBar
        left={
          selectedOptionId !== null ? (
            <Button kind="ghost" data-testid="btn-change-door" onClick={handleChangeOption}>
              Change door
            </Button>
          ) : undefined
        }
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
        note={
          selectedOptionId !== null && commitCount > 0 ? (
            <span data-testid="action-note">
              {commitCount} committed{restsApply ? ' · rest next room' : ''}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}
