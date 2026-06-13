import { useState } from 'react';
import { Hand, ShieldCheck, Siren } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { CrackTheTumblersParams } from './generate';
import { judge, resetPinBoost } from './judge';
import type { CrackTheTumblersState } from './judge';

/** Split a total into n brackets as evenly as possible, each ≥1 (front-loaded). */
function dealBrackets(total: number, n: number): number[] {
  if (n <= 0) return [];
  const safeTotal = Math.max(total, n); // everyone gets at least one card
  const base = Math.floor(safeTotal / n);
  const extra = safeTotal % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export function CrackTheTumblersComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<CrackTheTumblersParams>): JSX.Element {
  const brackets = dealBrackets(params.totalCards, committed.length);
  const totalCards = brackets.reduce((a, b) => a + b, 0);
  const [state, setState] = useState<CrackTheTumblersState>(() => ({
    totalCards,
    playsRecorded: 0,
    alarmTripped: false,
    resetPinUsed: false,
  }));
  const [dealt, setDealt] = useState(false);

  const gameComplete = state.alarmTripped || state.playsRecorded >= state.totalCards;
  const progressPct = state.totalCards > 0 ? (state.playsRecorded / state.totalCards) * 100 : 0;

  function handleInOrder() {
    if (gameComplete) return;
    setState(s =>
      s.playsRecorded >= s.totalCards ? s : { ...s, playsRecorded: s.playsRecorded + 1 },
    );
  }

  function handleClash() {
    if (gameComplete) return;
    setState(s => ({ ...s, alarmTripped: true }));
  }

  function handleBoost(hook: BoostHook<CrackTheTumblersState, CrackTheTumblersParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state));
  }

  const progressBarClass = state.alarmTripped ? 'mg-progress-bar mg-progress-bar--danger' : 'mg-progress-bar';

  return (
    <div data-testid="crack-the-tumblers">
      <StatusZone>
        {state.alarmTripped ? (
          <span className="mg-status-badge mg-status-badge--botched" data-testid="alarm-tripped">
            <Siren size={14} />
            Clash
          </span>
        ) : (
          <span className="mg-status-badge mg-status-badge--active">
            <ShieldCheck size={14} />
            {dealt ? 'Active' : 'Setup'}
          </span>
        )}

        <div className={progressBarClass} aria-label="Pins set">
          <div className="mg-progress-bar__label">
            <span data-testid="card-count">Pins set · {state.playsRecorded} / {state.totalCards}</span>
          </div>
          <div className="mg-progress-bar__track">
            <div
              className={`mg-progress-bar__fill${state.alarmTripped ? ' mg-progress-bar__fill--danger' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </StatusZone>

      <ChallengeZone>
        {!dealt ? (
          <div className="mg-setup-panel" data-testid="ctb-setup">
            <div className="mg-setup-panel__title">
              <Hand size={16} />
              Set up the table
            </div>
            <ol className="mg-setup-panel__steps">
              <li>Shuffle the pack.</li>
              <li>
                Deal <strong>{totalCards} cards</strong> face-down across the crew:{' '}
                <strong data-testid="ctb-deal-brackets">
                  {committed.map((p, i) => `${p.name} ${brackets[i]}`).join(' · ')}
                </strong>.
              </li>
              <li>Players peek at their own cards only. No talking, no signalling.</li>
            </ol>
            <p className="mg-setup-panel__rule">
              The crew plays every card to the table one at a time, <strong>lowest rank first,
              ascending</strong> (Ace low, King high). On <strong>equal ranks</strong>, play them
              in <strong>suit order: ♣ Clubs → ♦ Diamonds → ♥ Hearts → ♠ Spades</strong> — a tie
              played out of suit order is a clash. Record each play below — you are the referee.
            </p>
            <button
              type="button"
              className="mg-call-outcome-btn"
              data-testid="ctb-dealt"
              onClick={() => setDealt(true)}
            >
              Cards dealt — begin
            </button>
          </div>
        ) : (
          <>
            <div className={`ctb-subtext${state.alarmTripped ? ' ctb-subtext--danger' : ''}`} data-testid="ctb-status-line">
              {state.alarmTripped
                ? 'Clash — card out of ascending or suit order. Reset Pin forgives it once: hand the card back.'
                : state.playsRecorded >= state.totalCards
                  ? 'All pins set.'
                  : 'Record each card as it hits the table.'}
            </div>

            {!gameComplete && (
              <div className="mg-record-controls" data-testid="ctb-record-controls">
                <button
                  type="button"
                  className="mg-tbtn"
                  data-testid="ctb-in-order"
                  onClick={handleInOrder}
                >
                  <span className="mg-tl">✓</span>
                  <span className="mg-ts">In order</span>
                </button>
                <button
                  type="button"
                  className="mg-tbtn mg-tbtn--danger"
                  data-testid="ctb-clash"
                  onClick={handleClash}
                >
                  <span className="mg-tl">✗</span>
                  <span className="mg-ts">Clash</span>
                </button>
              </div>
            )}
          </>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<CrackTheTumblersState, CrackTheTumblersParams>
            hook={resetPinBoost}
            gameLanes={['tech']}
            committed={committed}
            onFire={handleBoost}
          />
        </div>

        <button
          type="button"
          className="mg-call-outcome-btn"
          data-testid="btn-call-outcome"
          onClick={handleCallOutcome}
        >
          Call Outcome
        </button>
      </RefereeZone>
    </div>
  );
}
