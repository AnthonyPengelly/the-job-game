import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, BookOpen, Scissors } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { CardSpread } from '@/minigames/primitives/CardSpread';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import { publishSlice } from '@/platform/channel';
import type { DefuseParams } from './generate';
import { judge, clearChannelBoost } from './judge';
import type { DefuseState } from './judge';

function initState(): DefuseState {
  return {
    cutIds: [],
    timerExpired: false,
    clearChannelUsed: false,
  };
}

export function DefuseComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<DefuseParams>): JSX.Element {
  const [state, setState] = useState<DefuseState>(initState);

  // Publish only the rulebook slice to the player-view — never the wire layout or safe/unsafe mapping.
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

  const wrongCutIds = state.cutIds.filter(id => !params.safeWireIds.includes(id));
  const safeCutsDone = state.cutIds.filter(id => params.safeWireIds.includes(id)).length;
  const allSafeDone = safeCutsDone >= params.safeWireIds.length;

  const alarmTripped = wrongCutIds.length > 0;

  const fillPct = params.safeWireIds.length > 0
    ? Math.min((safeCutsDone / params.safeWireIds.length) * 100, 100)
    : 0;

  let badgeClass = 'mg-status-badge mg-status-badge--active';
  let badgeIcon: React.ReactNode = <Scissors size={14} />;
  let badgeLabel = 'Defusing';

  if (alarmTripped) {
    badgeClass = 'mg-status-badge mg-status-badge--botched';
    badgeIcon = <AlertTriangle size={14} />;
    badgeLabel = 'ALARM TRIPPED';
  } else if (state.timerExpired && !allSafeDone) {
    badgeClass = 'mg-status-badge mg-status-badge--botched';
    badgeIcon = <XCircle size={14} />;
    badgeLabel = 'TIME';
  } else if (allSafeDone) {
    badgeClass = state.timerExpired
      ? 'mg-status-badge mg-status-badge--complication'
      : 'mg-status-badge mg-status-badge--clean';
    badgeIcon = <CheckCircle size={14} />;
    badgeLabel = 'DEFUSED';
  }

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

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  const wireCards = params.wires.map(w => ({
    id: w.id,
    label: `${w.color}/${w.symbol}`,
  }));

  return (
    <div data-testid="defuse-the-alarm">
      <StatusZone>
        <span className={badgeClass}>
          {badgeIcon}
          <span>{badgeLabel}</span>
        </span>
        <div className="mg-progress-bar">
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <span className="mg-progress-bar__label" data-testid="defuse-progress">
            {safeCutsDone} / {params.safeWireIds.length} safe cuts
          </span>
        </div>
        <Timer
          seconds={params.timerSeconds}
          running={!state.timerExpired && !alarmTripped}
          onExpire={handleTimerExpire}
          audible
        />
      </StatusZone>

      <ChallengeZone>
        <div data-testid="defuse-wires">
          <CardSpread
            cards={wireCards}
            layout="row"
            faceDown={state.cutIds}
            onTap={handleCut}
          />
        </div>

        {alarmTripped && (
          <div data-testid="defuse-wrong-cuts" className="mg-status-badge mg-status-badge--botched" style={{ marginTop: '0.75rem', display: 'inline-flex', fontSize: '1rem' }}>
            <AlertTriangle size={16} /> ALARM TRIPPED — wrong cut!
          </div>
        )}

        {state.clearChannelUsed && (
          <div data-testid="defuse-clear-channel-active" className="mg-status-badge mg-status-badge--complication" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
            Clear Channel active — one sentence allowed
          </div>
        )}

        {/* GM-only rulebook (glanceable reference; never reaches player-view) */}
        <details style={{ marginTop: '0.75rem' }}>
          <summary data-testid="defuse-rulebook-toggle" style={{ cursor: 'pointer', color: 'var(--fg-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <BookOpen size={14} /> Rules (GM only)
          </summary>
          <div data-testid="defuse-rulebook-gm" style={{ marginTop: '0.5rem' }}>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {params.cutRules.map((rule, i) => (
                <li key={i} data-testid={`defuse-gm-rule-${i}`} style={{ fontSize: '0.9rem', color: 'var(--fg)' }}>
                  {rule.text}
                </li>
              ))}
            </ul>
          </div>
        </details>
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<DefuseState, DefuseParams>
            hook={clearChannelBoost}
            gameLanes={['charm', 'stealth']}
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
