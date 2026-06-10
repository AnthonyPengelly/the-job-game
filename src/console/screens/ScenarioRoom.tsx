import { useState, useEffect } from 'react';
import { useGameStore } from '@/console/store';
import { PhaseHead, ActionBar, Button } from '@/console/ui';
import { Teleprompter } from '@/console/teleprompter';
import { useCrewRailMode } from '@/console/shell';
import { formatLoot } from '@/content/format';
import type { ScenarioChoice, ScenarioChoiceDef } from '@/engine';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Letter badge (A = index 0, B = index 1). */
function choiceLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

// ── Stage 1: Blind choice card (04a) ─────────────────────────────────────────

interface ChoiceCardProps {
  choice: ScenarioChoice;
  index: number;
  onSelect: () => void;
}

function ChoiceCard({ choice, index, onSelect }: ChoiceCardProps) {
  return (
    <div
      data-testid={`btn-choice-${choice.id}`}
      className="choice"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
    >
      <span className="ltr">{choiceLetter(index)}</span>
      <h4>{choice.label}</h4>
      <div className="hidden-foot" data-testid={`choice-foot-${choice.id}`}>
        {choice.isRoll ? 'Outcome hidden · may need a roll' : 'Outcome hidden · no roll'}
      </div>
    </div>
  );
}

// ── Stage 1b: Attempter picker (04b) ──────────────────────────────────────────

interface AttempterPickerProps {
  choice: ScenarioChoice;
  onBack: () => void;
}

function AttempterPicker({ choice, onBack }: AttempterPickerProps) {
  const crew = useGameStore(s => s.session.present.crew);
  const dispatch = useGameStore(s => s.dispatch);
  const { pickAttempter, selectedAttempter } = useCrewRailMode();

  function handleConfirm() {
    if (selectedAttempter === null) return;
    dispatch({ t: 'CHOOSE_SCENARIO', choiceId: choice.id, attemptedBy: selectedAttempter });
  }

  return (
    <div data-testid="attempter-select" className="scwrap">
      <div className="actionhdr">
        <span className="ltr">A</span>
        <span className="t">{choice.label}</span>
      </div>
      <div className="reveal" style={{ borderColor: 'var(--c-amber-700)', boxShadow: 'none', background: 'var(--c-surface-1)' }}>
        <span className="rk" style={{ color: 'var(--caution)' }}>Who attempts it?</span>
        <p className="prose muted">
          Tap a crew member on the left rail. Their rating on the tested lane becomes
          the bonus — send your strongest. Resting crew cannot attempt.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {crew.map(player => (
            <Button
              key={player.id}
              kind="secondary"
              data-testid={`btn-attempter-${player.id}`}
              onClick={() => pickAttempter(player.id)}
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
        right={
          <Button
            kind="primary"
            data-testid="btn-attempter-confirm"
            onClick={handleConfirm}
            disabled={selectedAttempter === null}
          >
            Reveal the roll
          </Button>
        }
      />
    </div>
  );
}

// ── Stage 2 pre-roll: DC derivation + odds (04c / 04d) ────────────────────────

function RollReveal() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const heat = useGameStore(s => s.session.present.heat);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const cfg = useGameStore(s => s.cfg);
  const diceMode = useGameStore(s => s.diceMode);
  const dispatch = useGameStore(s => s.dispatch);

  const [physicalRoll, setPhysicalRoll] = useState('');

  if (room === null || room.kind !== 'scenario' || room.pendingRoll === undefined) return null;

  const { pendingRoll } = room;
  const { dc, lane, laneRating, baseDifficulty } = pendingRoll;

  // heatTerm = Math.round(heatDC.perHeat × heat + heatDC.perRoom × roomIndex)
  // This is the same formula used in computeDC in scenario.ts.
  const heatTerm = Math.round(
    cfg.scenario.heatDC.perHeat * heat + cfg.scenario.heatDC.perRoom * roomIndex,
  );
  const oddsPercent = Math.round(((21 - dc) / 20) * 100);

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
    <div data-testid="roll-reveal" className="scwrap">
      {/* DC derivation row */}
      <div className="reveal">
        <span className="rk">The roll, in full — GM transparency</span>

        {/* Derivation: base − rating [+ heat] → DC */}
        <div className="equation" data-testid="reveal-derivation">
          <div className="eqcell">
            <span className="ek">Lane</span>
            <span
              data-testid="reveal-lane"
              className="ev"
              style={{ fontSize: 22, textTransform: 'uppercase', color: 'var(--data)' }}
            >
              {lane}
            </span>
            <span className="es">tested stat</span>
          </div>
          <div className="eqcell">
            <span className="ek">Attempter rating</span>
            <span data-testid="reveal-rating" className="ev">{laneRating}</span>
            <span className="es">the bonus</span>
          </div>
          <div className="eqcell">
            <span className="ek">Base difficulty</span>
            <span data-testid="reveal-base-difficulty" className="ev" style={{ color: 'var(--caution)' }}>
              {baseDifficulty}
            </span>
            <span className="es">the obstacle</span>
          </div>
          {heatTerm > 0 && (
            <div className="eqcell">
              <span className="ek">Heat term</span>
              <span data-testid="reveal-heat-term" className="ev" style={{ color: 'var(--danger)' }}>
                +{heatTerm}
              </span>
              <span className="es">escalation</span>
            </div>
          )}
          <div className="eqop">→</div>
          <div className="eqcell dc">
            <span className="ek">DC</span>
            <span data-testid="reveal-dc" className="ev">{dc}</span>
            <span className="es">need this+</span>
          </div>
        </div>

        {/* Derivation label for accessibility */}
        <div
          className="prose muted"
          style={{ fontSize: 13 }}
          data-testid="reveal-derivation-label"
        >
          {baseDifficulty} − {lane} rating {laneRating}
          {heatTerm > 0 ? ` + heat ${heatTerm}` : ''}
          {' '} → DC {dc}
        </div>

        {/* Odds bar */}
        <div className="odds">
          <span className="olabel" data-testid="reveal-odds">need {dc}+</span>
          <div className="otrack">
            <div className="ofill" style={{ width: `${oddsPercent}%` }} />
          </div>
          <span className="oval" data-testid="reveal-odds-pct">{oddsPercent}%</span>
        </div>
      </div>

      {/* Roll control */}
      <div className="reveal" style={{ boxShadow: 'none', borderColor: 'var(--border)' }}>
        {diceMode === 'app' ? (
          <>
            <span className="rk" style={{ color: 'var(--accent)' }}>App roll</span>
            <div className="rollctl">
              <div className="die armed">d20</div>
              <span className="rc-note">
                Roll the d20. The console resolves it against DC {dc}.
              </span>
            </div>
            <ActionBar
              right={
                <Button kind="primary" data-testid="btn-roll" onClick={handleAppRoll}>
                  Roll d20
                </Button>
              }
            />
          </>
        ) : (
          <>
            <span className="rk" style={{ color: 'var(--data)' }}>Enter the die roll</span>
            <div className="keypad">
              {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                <div
                  key={n}
                  className={`key${physicalVal === n ? ' sel' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPhysicalRoll(String(n))}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setPhysicalRoll(String(n)); }}
                >
                  {n}
                </div>
              ))}
            </div>
            {/* Hidden input for backward-compat with tests */}
            <input
              data-testid="input-physical-roll"
              type="number"
              className="inp"
              style={{ display: 'none' }}
              min={1}
              max={20}
              value={physicalRoll}
              onChange={e => setPhysicalRoll(e.target.value)}
            />
            {physicalRoll !== '' && !physicalValid && (
              <span
                data-testid="physical-roll-error"
                className="prose"
                style={{ color: 'var(--danger)', fontSize: 14 }}
              >
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
                  {physicalValid ? `Resolve · ${physicalVal}` : 'Submit'}
                </Button>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Stage 2 post-roll: result reveal ─────────────────────────────────────────

function RollResult() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const dispatch = useGameStore(s => s.dispatch);

  if (room === null || room.kind !== 'scenario' || room.resolvedRoll === undefined) return null;

  const { resolvedRoll } = room;
  const { roll, dc, result, lootDelta, heatDelta, gear } = resolvedRoll;
  const pass = roll >= dc;

  const resultColour =
    result === 'clean'
      ? 'var(--accent)'
      : result === 'complication'
        ? 'var(--caution)'
        : 'var(--danger)';

  const resultLabel =
    result === 'clean' ? 'Clean' : result === 'complication' ? 'Complication' : 'Botched';

  return (
    <div data-testid="roll-result" className="scwrap">
      <div className="reveal" style={{ borderColor: resultColour }}>
        <span className="rk" style={{ color: resultColour }}>Roll resolved</span>

        {/* d20 result vs DC */}
        <div className="equation">
          <div className="eqcell">
            <span className="ek">d20 rolled</span>
            <span data-testid="result-roll-value" className="ev" style={{ fontSize: 48 }}>
              {roll}
            </span>
          </div>
          <div className="eqop">{pass ? '≥' : '<'}</div>
          <div className="eqcell dc">
            <span className="ek">DC</span>
            <span className="ev">{dc}</span>
          </div>
          <div className="eqop">→</div>
          <div className="eqcell target" style={{ borderColor: resultColour, background: 'var(--bg-panel)' }}>
            <span className="ek">Result</span>
            <span
              data-testid="result-outcome"
              className="ev"
              style={{ color: resultColour, fontSize: 22, textTransform: 'uppercase' }}
            >
              {resultLabel}
            </span>
          </div>
        </div>

        {/* What was gained */}
        <div className="consq">
          <div className="c">
            <span className="k">Loot</span>
            <span
              data-testid="result-loot"
              className="v"
              style={{ color: lootDelta > 0 ? 'var(--accent)' : lootDelta < 0 ? 'var(--danger)' : 'var(--fg-faint)' }}
            >
              {lootDelta === 0 ? '±0' : lootDelta > 0 ? `+${formatLoot(lootDelta)}` : formatLoot(lootDelta)}
            </span>
          </div>
          <div className="c">
            <span className="k">Heat</span>
            <span
              data-testid="result-heat"
              className="v"
              style={{ color: heatDelta > 0 ? 'var(--danger)' : heatDelta < 0 ? 'var(--accent)' : 'var(--fg-faint)' }}
            >
              {heatDelta === 0 ? '±0' : heatDelta > 0 ? `+${heatDelta}` : `${heatDelta}`}
            </span>
          </div>
          {gear !== undefined && (
            <div className="c">
              <span className="k">Gear</span>
              <span data-testid="result-gear" className="v" style={{ color: 'var(--accent)' }}>
                {gear.kind === 'bigScore' ? 'Big Score' : gear.kind === 'powerUp' ? 'Power-up' : 'Stat Boost'}
                {gear.lane !== undefined ? ` (${gear.lane})` : ''}
                {gear.lanes !== undefined ? ` (${gear.lanes.join('/')})` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      <ActionBar
        right={
          <Button
            kind="primary"
            data-testid="btn-continue"
            onClick={() => dispatch({ t: 'ACK_SCENARIO_ROLL' })}
          >
            Continue
          </Button>
        }
      />
    </div>
  );
}

// ── Stage 1c-reveal: non-roll effect reveal (04e) ─────────────────────────────

interface NoRollRevealProps {
  choiceDef: ScenarioChoiceDef;
}

function NoRollReveal({ choiceDef }: NoRollRevealProps) {
  const dispatch = useGameStore(s => s.dispatch);
  const room = useGameStore(s => s.session.present.currentRoom);

  if (room === null || room.kind !== 'scenario' || !('effect' in choiceDef)) return null;

  const { effect } = choiceDef;
  const { heatDelta, lootDelta, gear } = effect;

  function handleContinue() {
    dispatch({ t: 'CHOOSE_SCENARIO', choiceId: choiceDef.id });
  }

  return (
    <div data-testid="effect-reveal" className="scwrap" style={{ justifyContent: 'center' }}>
      <div className="effect">
        <span className="eyebrow">Hidden effect revealed</span>
        <h3>{choiceDef.label}</h3>
        <div className="consq">
          <div className="c">
            <span className="k">Loot</span>
            <span
              data-testid="effect-loot"
              className="v"
              style={{ color: lootDelta > 0 ? 'var(--accent)' : lootDelta < 0 ? 'var(--danger)' : 'var(--fg-faint)' }}
            >
              {lootDelta === 0 ? '±0' : lootDelta > 0 ? `+${formatLoot(lootDelta)}` : formatLoot(lootDelta)}
            </span>
          </div>
          <div className="c">
            <span className="k">Heat</span>
            <span
              data-testid="effect-heat"
              className="v"
              style={{ color: heatDelta > 0 ? 'var(--danger)' : heatDelta < 0 ? 'var(--accent)' : 'var(--fg-faint)' }}
            >
              {heatDelta === 0 ? '±0' : heatDelta > 0 ? `+${heatDelta}` : `${heatDelta}`}
            </span>
          </div>
          {gear !== undefined && (
            <div className="c">
              <span className="k">Gear</span>
              <span data-testid="effect-gear" className="v" style={{ color: 'var(--accent)' }}>
                {gear.kind === 'bigScore' ? 'Big Score' : gear.kind === 'powerUp' ? 'Power-up' : 'Stat Boost'}
                {gear.lane !== undefined ? ` (${gear.lane})` : ''}
                {gear.lanes !== undefined ? ` (${gear.lanes.join('/')})` : ''}
              </span>
            </div>
          )}
        </div>
      </div>
      <ActionBar
        right={
          <Button
            kind="primary"
            data-testid="btn-continue-effect"
            onClick={handleContinue}
          >
            Continue
          </Button>
        }
      />
    </div>
  );
}

// ── Scenario room screen ──────────────────────────────────────────────────────

/**
 * GM console screen for scenario rooms (phase='room', currentRoom.kind='scenario').
 *
 * Stage flow:
 *   04a  Blind A/B cards — flavour labels only, no effect details, no DC/odds.
 *   04b  Roll choice selected: attempter rail enters 'attempter' mode; inline
 *        attempter picker also shown. Dispatches CHOOSE_SCENARIO {attemptedBy}.
 *   04c/d  pendingRoll set: reveals DC-derivation row and odds ("need N+") then
 *          app-roll or physical-die entry. Dispatches RESOLVE_SCENARIO_ROLL.
 *   post-roll  resolvedRoll set: shows d20 value, clean/complication/botched
 *          result label, and Loot/Heat/Gear gained. Continue → ACK_SCENARIO_ROLL.
 *   04e  Non-roll choice committed (local noRollRevealed flag set): surfaces the
 *        hidden effect. Continue → CHOOSE_SCENARIO (transitions to offer).
 *        No Back button — can't peek and switch after commit.
 *
 * Design ruling: effect stays hidden until commit; no peek-and-switch affordance.
 *
 * Reveal maths (§10.3): DC = base − rating + heatTerm (clamped). Derivation row
 * shows all four — base, lane, rating, heat term (when > 0) → DC. Comparison row
 * shows raw d20 vs DC ("need N+"). The rating is NOT added to the roll value for
 * comparison — it is already baked into DC, so adding it again double-counts.
 */
export function ScenarioRoom() {
  const room = useGameStore(s => s.session.present.currentRoom);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const crew = useGameStore(s => s.session.present.crew);
  const director = useGameStore(s => s.director);
  const cfg = useGameStore(s => s.cfg);

  const { activateAttempter, deactivate } = useCrewRailMode();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Set to true after user clicks "Commit" on a no-roll choice — shows 04e reveal.
  const [noRollRevealed, setNoRollRevealed] = useState(false);

  const crewNames = crew.map(p => p.name).join(', ');
  const roomNum = String(roomIndex + 1).padStart(2, '0');

  const [lines] = useState<string[]>(() => {
    if (!director || room?.kind !== 'scenario') return [];
    return [
      ...director.script('roomApproach', { roomNum, crew: crewNames }),
      ...director.script('scenarioSetup', { roomNum, crew: crewNames }),
    ];
  });
  const [lineIndex, setLineIndex] = useState(0);

  // Deactivate crew rail attempter mode when this screen unmounts.
  useEffect(() => {
    return () => { deactivate(); };
  }, [deactivate]);

  if (room === null || room.kind !== 'scenario') return null;

  const currentLine = lines[lineIndex] ?? '';
  const hasNext = lineIndex < lines.length - 1;

  function handleAdvance() {
    setLineIndex(i => Math.min(i + 1, lines.length - 1));
  }

  // Stage 2 post-roll: resolvedRoll is set — show the result reveal
  if (room.resolvedRoll !== undefined) {
    return (
      <div className="stage-inner" data-testid="screen-room">
        <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
        <RollResult />
      </div>
    );
  }

  // Stage 2 pre-roll: pendingRoll is set — show DC derivation + roll control
  if (room.pendingRoll !== undefined) {
    return (
      <div className="stage-inner" data-testid="screen-room">
        <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
        <RollReveal />
      </div>
    );
  }

  // Stage 04e: no-roll choice committed — show effect reveal (no back button)
  if (noRollRevealed && selectedId !== null) {
    const scenarioDef = cfg.roomTemplates.scenarios.find(t => t.id === room.templateId);
    const choiceDef = scenarioDef?.choices.find(c => c.id === selectedId);
    if (choiceDef !== undefined && 'effect' in choiceDef) {
      return (
        <div className="stage-inner" data-testid="screen-room">
          <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
          <NoRollReveal choiceDef={choiceDef} />
        </div>
      );
    }
  }

  // Stage 1: no choice selected — blind A/B cards
  if (selectedId === null) {
    return (
      <div className="stage-inner" data-testid="screen-room">
        <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
        <div data-testid="scenario-narration">
          <Teleprompter line={currentLine} hasNext={hasNext} onAdvance={handleAdvance} />
        </div>
        <p data-testid="scenario-setup" className="prose">
          {room.setup}
        </p>
        <div className="choices2" data-testid="scenario-choices">
          {room.choices.map((choice, i) => (
            <ChoiceCard
              key={choice.id}
              choice={choice}
              index={i}
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

  // Stage 1b: roll choice — pick attempter before dispatching CHOOSE_SCENARIO
  if (selectedChoice.isRoll) {
    return (
      <div className="stage-inner" data-testid="screen-room">
        <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
        <AttempterPicker
          choice={selectedChoice}
          onBack={() => {
            setSelectedId(null);
            deactivate();
          }}
        />
      </div>
    );
  }

  // Stage 1c: no-roll choice — confirm before revealing the effect
  return (
    <div className="stage-inner" data-testid="screen-room">
      <PhaseHead eyebrow={`Room ${roomNum} B · Scenario`} title="Scenario" />
      <div data-testid="confirmed-choice" className="panel">
        <div className="panel-head">
          <h3>Commit choice</h3>
        </div>
        <div className="panel-body">
          <span data-testid="confirmed-label" className="prose">
            {selectedChoice.label}
          </span>
          <p className="prose muted" style={{ fontSize: 14 }}>
            Once committed the hidden effect is revealed — you cannot switch choices.
          </p>
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
            onClick={() => setNoRollRevealed(true)}
          >
            Commit choice
          </Button>
        }
      />
    </div>
  );
}
