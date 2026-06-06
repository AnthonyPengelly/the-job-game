import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { Teleprompter } from '@/console/teleprompter';
import type { PlayerId, ScenarioChoice } from '@/engine';

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

// ── Attempter picker (stage 1b — roll choice only) ────────────────────────────

interface AttempterPickerProps {
  choiceId: string;
  onBack: () => void;
}

function AttempterPicker({ choiceId, onBack }: AttempterPickerProps) {
  const crew = useGameStore(s => s.session.present.crew);
  const dispatch = useGameStore(s => s.dispatch);

  function handlePick(playerId: PlayerId) {
    dispatch({ t: 'CHOOSE_SCENARIO', choiceId, attemptedBy: playerId });
  }

  return (
    <div data-testid="attempter-select">
      <p>Who attempts this?</p>
      {crew.map(player => (
        <button
          key={player.id}
          data-testid={`btn-attempter-${player.id}`}
          onClick={() => handlePick(player.id)}
        >
          {player.name}
        </button>
      ))}
      <button data-testid="btn-back" onClick={onBack}>
        Back
      </button>
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
    <div data-testid="roll-reveal">
      <div>
        <span data-testid="reveal-lane">{pendingRoll.lane}</span>
        {' '}
        <span data-testid="reveal-rating">{pendingRoll.laneRating}</span>
        {' '}
        <span data-testid="reveal-base-difficulty">{pendingRoll.baseDifficulty}</span>
      </div>
      <div>
        DC: <span data-testid="reveal-dc">{dc}</span>
      </div>
      <div>
        Odds: <span data-testid="reveal-odds">{odds}</span>
      </div>
      {diceMode === 'app' ? (
        <button data-testid="btn-roll" onClick={handleAppRoll}>
          Roll
        </button>
      ) : (
        <div>
          <input
            data-testid="input-physical-roll"
            type="number"
            min={1}
            max={20}
            value={physicalRoll}
            onChange={e => setPhysicalRoll(e.target.value)}
          />
          {physicalRoll !== '' && !physicalValid && (
            <span data-testid="physical-roll-error">Enter a number between 1 and 20</span>
          )}
          <button
            data-testid="btn-submit-physical"
            onClick={handlePhysicalSubmit}
            disabled={!physicalValid}
          >
            Submit
          </button>
        </div>
      )}
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
 *   Stage 1b   — roll choice selected: attempter picker prompts the GM to choose
 *                which crew member attempts; dispatches CHOOSE_SCENARIO {
 *                choiceId, attemptedBy }; engine returns pendingRoll.
 *   Stage 1c   — no-roll choice selected: confirmation view; dispatches
 *                CHOOSE_SCENARIO { choiceId } and advances to Offer.
 *   Stage two  — pendingRoll set: reveals lane, rating, DC, success odds, and
 *                the appropriate roll control (app: Roll button; physical: 1–20
 *                input). Dispatches RESOLVE_SCENARIO_ROLL.
 */
export function ScenarioRoom() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const director = useGameStore(s => s.director);
  const dispatch = useGameStore(s => s.dispatch);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Framing line for the scenario: picked once at mount (RoomRouter guarantees
  // room.kind === 'scenario' when this component is alive).
  const [setupLine, setSetupLine] = useState<string>(() =>
    director && room?.kind === 'scenario'
      ? director.next('scenarioSetup')
      : ''
  );

  if (room === null || room.kind !== 'scenario') return null;

  function handleSetupAdvance() {
    if (!director) return;
    setSetupLine(director.next('scenarioSetup'));
  }

  // Stage 2: roll pending after CHOOSE_SCENARIO for a roll choice
  if (room.pendingRoll !== undefined) {
    return (
      <div data-testid="screen-room">
        <h2>Scenario</h2>
        <RollReveal />
      </div>
    );
  }

  // Stage 1: choose an option (neither choice has been selected yet)
  if (selectedId === null) {
    return (
      <div data-testid="screen-room">
        <h2>Scenario</h2>
        <div data-testid="scenario-narration">
          <Teleprompter line={setupLine} onAdvance={handleSetupAdvance} />
        </div>
        <p data-testid="scenario-setup">{room.setup}</p>
        <div data-testid="scenario-choices">
          {room.choices.map(choice => (
            <ChoiceCard
              key={choice.id}
              choice={choice}
              onSelect={() => setSelectedId(choice.id)}
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
      <div data-testid="screen-room">
        <h2>Scenario</h2>
        <AttempterPicker
          choiceId={selectedId}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  // Stage 1c: no-roll choice — confirm before dispatching
  return (
    <div data-testid="screen-room">
      <h2>Scenario</h2>
      <div data-testid="confirmed-choice">
        <span data-testid="confirmed-label">{selectedChoice.label}</span>
      </div>
      <button
        data-testid="btn-confirm"
        onClick={() => dispatch({ t: 'CHOOSE_SCENARIO', choiceId: selectedId })}
      >
        Confirm
      </button>
    </div>
  );
}
