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

  const gameComplete = state.alarmTripped || state.playedSequence.length === params.cards.length;

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

  const played = state.playedSequence.length;
  const total = params.cards.length;
  const progressPct = total > 0 ? (played / total) * 100 : 0;

  return (
    <div data-testid="crack-the-tumblers">
      <StatusZone>
        {state.alarmTripped ? (
          <span
            className="mg-status-badge mg-status-badge--botched"
            data-testid="alarm-tripped"
          >
            <Siren size={14} />
            ALARM TRIPPED
          </span>
        ) : (
          <span className="mg-status-badge mg-status-badge--active">
            <ShieldCheck size={14} />
            Armed
          </span>
        )}

        <div className="mg-progress-bar" aria-label="Progress">
          <div className="mg-progress-bar__label">
            <span data-testid="card-count">Pins: {total}</span>
            {' · '}
            <span>Played: {played}/{total}</span>
          </div>
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <span className="mg-mode-label" data-testid="mg-mode-label">
          Crack
        </span>
      </StatusZone>

      <ChallengeZone>
        <CardSpread
          cards={params.cards}
          layout="row"
          faceDown={state.playedSequence}
          {...(!gameComplete && { onTap: handleCardTap })}
        />

        <div data-testid="played-sequence">
          {state.playedSequence.map((id, i) => {
            const card = params.cards.find(c => c.id === id);
            return (
              <span key={id} data-testid={`played-${i}`}>
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
