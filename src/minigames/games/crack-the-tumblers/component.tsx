import { useState } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { CardSpread } from '@/minigames/primitives/CardSpread';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
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
  const suggested = judge(state, params);

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

  return (
    <div data-testid="crack-the-tumblers">
      <div data-testid="crack-tumblers-info">
        <span data-testid="card-count">Pins: {params.cards.length}</span>
        <span> | Played: {state.playedSequence.length}/{params.cards.length}</span>
        {state.alarmTripped && (
          <span data-testid="alarm-tripped"> — ALARM TRIPPED</span>
        )}
      </div>

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

      <div data-testid="boosts">
        <BoostButton<CrackTheTumblersState, CrackTheTumblersParams>
          hook={resetPinBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
