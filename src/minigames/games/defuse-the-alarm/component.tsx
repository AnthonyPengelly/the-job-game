import { useState, useEffect } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { CardSpread } from '@/minigames/primitives/CardSpread';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
import { publishSlice } from '@/platform/channel';
import type { DefuseParams } from './generate';
import { judge, clearChannelBoost, spareWireBoost } from './judge';
import type { DefuseState } from './judge';

function initState(): DefuseState {
  return {
    cutIds: [],
    timerExpired: false,
    clearChannelUsed: false,
    spareWireUsed: false,
  };
}

export function DefuseComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<DefuseParams>): JSX.Element {
  const [state, setState] = useState<DefuseState>(initState);

  // Publish the rulebook (and only the rulebook) to the player-view when the game starts.
  // The player-view never receives the wire layout or safe/unsafe mapping (GM-only).
  useEffect(() => {
    publishSlice({
      kind: 'defuse-rulebook',
      rules: params.cutRules.map(r => r.text),
      gameActive: true,
    });
    return () => {
      publishSlice({ kind: 'idle' });
    };
  }, [params]);

  const suggested = judge(state, params);

  function handleCut(wireId: CardId) {
    setState(s => {
      if (s.cutIds.includes(wireId)) return s;
      return { ...s, cutIds: [...s.cutIds, wireId] };
    });
  }

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleBoost(hook: BoostHook<DefuseState, DefuseParams>) {
    setState(s => hook.apply(s, params));
  }

  const wrongCutIds = state.cutIds.filter(id => !params.safeWireIds.includes(id));
  const safeCutsDone = state.cutIds.filter(id => params.safeWireIds.includes(id)).length;

  const wireCards = params.wires.map(w => ({
    id: w.id,
    label: `${w.color}/${w.symbol}`,
  }));

  return (
    <div data-testid="defuse-the-alarm">
      <div data-testid="defuse-rulebook-gm">
        <strong>Rules (GM reference):</strong>
        <ul>
          {params.cutRules.map((rule, i) => (
            <li key={i} data-testid={`defuse-gm-rule-${i}`}>
              {rule.text}
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="defuse-wires">
        <CardSpread
          cards={wireCards}
          layout="row"
          faceDown={state.cutIds}
          onTap={handleCut}
        />
      </div>

      <div data-testid="defuse-progress">
        Safe cuts: {safeCutsDone}/{params.safeWireIds.length}
      </div>

      {wrongCutIds.length > 0 && (
        <div data-testid="defuse-wrong-cuts">
          {state.spareWireUsed ? '⚠️ Wrong cut — FORGIVEN (Spare Wire)' : '🚨 ALARM TRIPPED — wrong cut'}
        </div>
      )}

      {state.clearChannelUsed && (
        <div data-testid="defuse-clear-channel-active">
          Clear Channel active — one sentence allowed
        </div>
      )}

      <Timer
        seconds={params.timerSeconds}
        running={!state.timerExpired}
        onExpire={handleTimerExpire}
        audible
      />

      <div data-testid="boosts">
        <BoostButton<DefuseState, DefuseParams>
          hook={clearChannelBoost}
          committed={committed}
          onFire={handleBoost}
        />
        <BoostButton<DefuseState, DefuseParams>
          hook={spareWireBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
