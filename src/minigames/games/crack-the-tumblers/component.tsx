import { useState } from 'react';
import { ShieldCheck, Siren } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { CardSpread } from '@/minigames/primitives/CardSpread';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { CrackTheTumblersParams } from './generate';
import { judge, resetPinBoost } from './judge';
import type { CrackTheTumblersState } from './judge';

function initState(): CrackTheTumblersState {
  return { playedSequence: [], alarmTripped: false, resetPinUsed: false };
}

function cardValue(params: CrackTheTumblersParams, id: CardId): number {
  return parseInt(params.cards.find(c => c.id === id)?.label ?? '0', 10);
}

export function CrackTheTumblersComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<CrackTheTumblersParams>): JSX.Element {
  const [state, setState] = useState<CrackTheTumblersState>(initState);

  const played = state.playedSequence.length;
  const total = params.cards.length;
  const gameComplete = state.alarmTripped || played === total;
  const progressPct = total > 0 ? (played / total) * 100 : 0;

  const lastPlayedId = state.playedSequence[played - 1];
  const lastPlayedValue = lastPlayedId !== undefined ? cardValue(params, lastPlayedId) : null;

  // Unplayed cards (in their original shuffled order) for tapping
  const unplayedCards = params.cards.filter(c => !state.playedSequence.includes(c.id));

  function handleCardTap(id: CardId) {
    if (gameComplete) return;
    if (state.playedSequence.includes(id)) return;

    const last = state.playedSequence[state.playedSequence.length - 1];
    const newVal = cardValue(params, id);
    const prevVal = last !== undefined ? cardValue(params, last) : -Infinity;
    const isClash = newVal <= prevVal;

    setState(s => ({
      ...s,
      playedSequence: [...s.playedSequence, id],
      alarmTripped: isClash,
    }));
  }

  function handleBoost(hook: BoostHook<CrackTheTumblersState, CrackTheTumblersParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state, params));
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
            Active
          </span>
        )}

        <div className={progressBarClass} aria-label="Pins set">
          <div className="mg-progress-bar__label">
            <span data-testid="card-count">Pins set · {played} / {total}</span>
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
        {/* Pin board: played pins (lit), next slot (?), remaining (face-down) */}
        <div className="ctb-pinboard" data-testid="pin-board" aria-label="Pin board">
          {params.correctOrder.map((id, i) => {
            const isPlayed = state.playedSequence.includes(id);
            const isNext = i === played && !gameComplete;
            const card = params.cards.find(c => c.id === id);
            const playedCard = isPlayed
              ? params.cards.find(c => c.id === state.playedSequence[i])
              : null;

            if (isPlayed) {
              const clashIndex = state.alarmTripped
                ? state.playedSequence.length - 1
                : -1;
              const isClash = state.alarmTripped && i === clashIndex;
              return (
                <div
                  key={id}
                  className={`ctb-pin ctb-pin--played${isClash ? ' ctb-pin--clash' : ''}`}
                  data-testid={`pin-played-${i}`}
                >
                  {playedCard?.label ?? card?.label ?? '?'}
                </div>
              );
            }
            if (isNext) {
              return (
                <div key={id} className="ctb-pin ctb-pin--next" data-testid="pin-next">
                  ?
                </div>
              );
            }
            return (
              <div key={id} className="ctb-pin ctb-pin--empty" data-testid={`pin-empty-${i}`} />
            );
          })}
        </div>

        {/* Sub-text: what to beat next, or clash message */}
        <div className={`ctb-subtext${state.alarmTripped ? ' ctb-subtext--danger' : ''}`}>
          {state.alarmTripped
            ? 'Clash — card out of sequence. Reset Pin forgives it once.'
            : played === total
              ? 'All pins set.'
              : lastPlayedValue !== null
                ? `Next must beat ${lastPlayedValue} · lower trips it`
                : 'Play lowest card first'}
        </div>

        {/* Unplayed cards — tap to register a play */}
        {!gameComplete && unplayedCards.length > 0 && (
          <div className="ctb-hand">
            <div className="ctb-hand-label">Tap to play:</div>
            <CardSpread
              cards={unplayedCards}
              layout="row"
              faceDown={[]}
              onTap={handleCardTap}
            />
          </div>
        )}

        {/* Played sequence readout for GM reference */}
        <div className="ctb-played-row" data-testid="played-sequence">
          {state.playedSequence.map((id, i) => {
            const card = params.cards.find(c => c.id === id);
            return (
              <span key={id} data-testid={`played-${i}`} className="ctb-played-val">
                {i > 0 ? ' → ' : ''}{card?.label ?? '?'}
              </span>
            );
          })}
        </div>
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
