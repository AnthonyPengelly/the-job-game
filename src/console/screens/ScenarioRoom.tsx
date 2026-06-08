import { useState, useEffect } from 'react';
import { useGameStore } from '@/console/store';
import { PhaseHead, ActionBar, Button } from '@/console/ui';
import { Teleprompter } from '@/console/teleprompter';
import { useCrewRailMode } from '@/console/shell';
import type { PlayerId, ScenarioChoice } from '@/engine';

// ── Stage-one choice card ─────────────────────────────────────────────────────

interface ChoiceCardProps {
  choice: ScenarioChoice;
  onSelect: () => void;
}

function ChoiceCard({ choice, onSelect }: ChoiceCardProps) {
  return (
    <div data-testid={`choice-card-${choice.id}`} className="opt safe">
      <Button
        kind="secondary"
        data-testid={`btn-choice-${choice.id}`}
        onClick={onSelect}
      >
        {choice.label}
      </Button>
    </div>
  );
}

// ── Attempter picker (stage 1b — roll choice only) ────────────────────────────

interface AttempterPickerProps {
  choiceId: string;
  onBack: () => void;
}

function AttempterPicker({ choiceId, onBack }: AttempterPickerProps) {
  const crew = useGameStore(s => s.session.present.crew);
  const dispatch = useGameStore(s => s.dispatch);
  const { pickAttempter } = useCrewRailMode();

  function handlePick(playerId: PlayerId) {
    pickAttempter(playerId);
    dispatch({ t: 'CHOOSE_SCENARIO', choiceId, attemptedBy: playerId });
  }

  return (
    <div data-testid="attempter-select" className="panel">
      <div className="panel-head">
        <h3>Who attempts this?</h3>
      </div>
      <div className="panel-body">
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {crew.map(player => (
            <Button
              key={player.id}
              kind="secondary"
              data-testid={`btn-attempter-${player.id}`}
              onClick={() => handlePick(player.id)}
            >
              {player.name}
            </Button>
          ))}
        </div>
      </div>
      <ActionBar
        left={
          <Button kind="ghost" data-testid="btn-back" onClick={onBack}>
            Back
          </Button>
        }
      />
    </div>
  );
}

// ── Roll reveal (stage 2 — after CHOOSE_SCENARIO sets pendingRoll) ────────────

function RollReveal() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const diceMode = useGameStore(s => s.diceMode);
  const dispatch = useGameStore(s => s.dispatch);

  const [physicalRoll, setPhysicalRoll] = useState('');

  if (room === null || room.kind !== 'scenario' || room.pendingRoll === undefined) return null;

  const { pendingRoll } = room;
  const dc = pendingRoll.dc;
  const odds = (21 - dc) / 20;

  const physicalVal = parseInt(physicalRoll, 10);
  const physicalValid = !isNaN(physicalVal) && physicalVal >= 1 && physicalVal <= 20;

  function handleAppRoll() {
    dispatch({ t: 'RESOLVE_SCENARIO_ROLL' });
  }

  function handlePhysicalSubmit() {
    if (!physicalValid) return;
    dispatch({ t: 'RESOLVE_SCENARIO_ROLL', externalRoll: physicalVal });
  }

  return (
    <div data-testid="roll-reveal" className="panel">
      <div className="panel-head">
        <h3>Roll</h3>
        <span className="panel-tag">Stage Two — revealed</span>
      </div>
      <div className="panel-body">
        <div className="grid-3">
          <div className="readout">
            <span className="k">Lane</span>
            <span data-testid="reveal-lane" className="v" style={{ fontSize: 22, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
              {pendingRoll.lane}
            </span>
          </div>
          <div className="readout">
            <span className="k">Rating</span>
            <span data-testid="reveal-rating" className="v">{pendingRoll.laneRating}</span>
          </div>
          <div className="readout">
            <span className="k">DC</span>
            <span data-testid="reveal-dc" className="v" style={{ color: 'var(--danger)' }}>{dc}</span>
          </div>
        </div>
        <div className="readout" style={{ alignSelf: 'flex-start' }}>
          <span className="k">Success odds</span>
          <span data-testid="reveal-odds" className="v" style={{ fontSize: 32 }}>{odds}</span>
        </div>
        <span data-testid="reveal-base-difficulty" style={{ display: 'none' }}>
          {pendingRoll.baseDifficulty}
        </span>
        {diceMode === 'app' ? (
          <ActionBar
            right={
              <Button kind="primary" data-testid="btn-roll" onClick={handleAppRoll}>
                Roll
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="field">
              <label>Physical roll (1–20)</label>
              <input
                data-testid="input-physical-roll"
                type="number"
                className="inp"
                min={1}
                max={20}
                value={physicalRoll}
                onChange={e => setPhysicalRoll(e.target.value)}
              />
            </div>
            {physicalRoll !== '' && !physicalValid && (
              <span data-testid="physical-roll-error" className="prose" style={{ color: 'var(--danger)', fontSize: 14 }}>
                Enter a number between 1 and 20
              </span>
            )}
            <ActionBar
              right={
                <Button
                  kind="primary"
                  data-testid="btn-submit-physical"
                  onClick={handlePhysicalSubmit}
                  disabled={!physicalValid}
                >
                  Submit
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scenario room screen ──────────────────────────────────────────────────────

/**
 * GM console screen for scenario rooms (phase='room', currentRoom.kind='scenario').
 *
 * Two-stage reveal (design §10.3):
 *   Stage one  — setup text + both choice labels shown as flavour only; no lane,
 *                no DC, no Heat/Loot numbers (opaque-to-commit rule).
 *   Stage 1b   — roll choice selected: the crew rail enters attempter mode;
 *                the attempter picker panel also renders inline as the tap target;
 *                dispatches CHOOSE_SCENARIO { choiceId, attemptedBy }.
 *   Stage 1c   — no-roll choice selected: confirmation view; dispatches
 *                CHOOSE_SCENARIO { choiceId } and advances to Offer.
 *   Stage two  — pendingRoll set: reveals lane, rating, DC, success odds, and
 *                the appropriate roll control (app: Roll button; physical: 1–20
 *                input). Dispatches RESOLVE_SCENARIO_ROLL.
 */
export function ScenarioRoom() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const director = useGameStore(s => s.director);
  const dispatch = useGameStore(s => s.dispatch);

  const { activateAttempter, deactivate } = useCrewRailMode();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Framing line for the scenario: picked once at mount.
  const [setupLine, setSetupLine] = useState<string>(() =>
    director && room?.kind === 'scenario'
      ? director.next('scenarioSetup')
      : ''
  );

  // Deactivate crew rail attempter mode when this screen unmounts.
  useEffect(() => {
    return () => { deactivate(); };
  }, [deactivate]);

  if (room === null || room.kind !== 'scenario') return null;

  const roomNum = String(roomIndex + 1).padStart(2, '0');

  function handleSetupAdvance() {
    if (!director) return;
    setSetupLine(director.next('scenarioSetup'));
  }

  // Stage 2: roll pending after CHOOSE_SCENARIO for a roll choice
  if (room.pendingRoll !== undefined) {
    return (
      <div className="stage-inner" data-testid="screen-room">
        <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
        <RollReveal />
      </div>
    );
  }

  // Stage 1: choose an option (neither choice has been selected yet)
  if (selectedId === null) {
    return (
      <div className="stage-inner" data-testid="screen-room">
        <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
        <div data-testid="scenario-narration">
          <Teleprompter line={setupLine} onAdvance={handleSetupAdvance} />
        </div>
        <p data-testid="scenario-setup" className="prose">
          {room.setup}
        </p>
        <div className="grid-2" data-testid="scenario-choices">
          {room.choices.map(choice => (
            <ChoiceCard
              key={choice.id}
              choice={choice}
              onSelect={() => {
                setSelectedId(choice.id);
                if (choice.isRoll) {
                  activateAttempter();
                }
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const selectedChoice = room.choices.find(c => c.id === selectedId)!;

  // Stage 1b: roll choice — pick attempter before dispatching
  if (selectedChoice.isRoll) {
    return (
      <div className="stage-inner" data-testid="screen-room">
        <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
        <AttempterPicker
          choiceId={selectedId}
          onBack={() => {
            setSelectedId(null);
            deactivate();
          }}
        />
      </div>
    );
  }

  // Stage 1c: no-roll choice — confirm before dispatching
  return (
    <div className="stage-inner" data-testid="screen-room">
      <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
      <div data-testid="confirmed-choice" className="panel">
        <div className="panel-head">
          <h3>Confirm choice</h3>
        </div>
        <div className="panel-body">
          <span data-testid="confirmed-label" className="prose">
            {selectedChoice.label}
          </span>
        </div>
      </div>
      <ActionBar
        left={
          <Button kind="ghost" onClick={() => setSelectedId(null)}>
            Back
          </Button>
        }
        right={
          <Button
            kind="primary"
            data-testid="btn-confirm"
            onClick={() => dispatch({ t: 'CHOOSE_SCENARIO', choiceId: selectedId })}
          >
            Confirm
          </Button>
        }
      />
    </div>
  );
}
