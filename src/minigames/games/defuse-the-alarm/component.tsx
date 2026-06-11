import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, BookOpen, Hand, MessageSquare } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import { publishSlice } from '@/platform/channel';
import type { DefuseParams } from './generate';
import { judge, clearChannelBoost } from './judge';
import type { DefuseState } from './judge';

function initState(): DefuseState {
  return {
    safeCuts: 0,
    wrongCut: false,
    allClear: false,
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
  const [dealt, setDealt] = useState(false);

  // Publish only the rulebook slice to the player-view — never anything GM-only.
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

  const gameOver = state.wrongCut || state.allClear || state.timerExpired;

  let badgeClass = 'mg-status-badge mg-status-badge--active';
  let badgeIcon: React.ReactNode = null;
  let badgeLabel = dealt ? 'Defusing' : 'Setup';

  if (state.wrongCut) {
    badgeClass = 'mg-status-badge mg-status-badge--botched';
    badgeIcon = <AlertTriangle size={14} />;
    badgeLabel = 'ALARM TRIPPED';
  } else if (state.allClear) {
    badgeClass = 'mg-status-badge mg-status-badge--clean';
    badgeIcon = <CheckCircle size={14} />;
    badgeLabel = 'DEFUSED';
  } else if (state.timerExpired) {
    badgeClass = 'mg-status-badge mg-status-badge--botched';
    badgeIcon = <XCircle size={14} />;
    badgeLabel = 'TIME';
  }

  function handleSafeCut() {
    if (gameOver) return;
    setState(s => ({ ...s, safeCuts: s.safeCuts + 1 }));
  }

  function handleWrongCut() {
    if (gameOver) return;
    setState(s => ({ ...s, wrongCut: true }));
  }

  function handleAllClear() {
    if (gameOver) return;
    setState(s => ({ ...s, allClear: true }));
  }

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
  }

  function handleBoost(hook: BoostHook<DefuseState, DefuseParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state));
  }

  return (
    <div data-testid="defuse-the-alarm">
      <StatusZone>
        <span className={badgeClass} data-testid="defuse-badge">
          {badgeIcon}
          <span>{badgeLabel}</span>
        </span>
        <span className="mg-dial-inline" data-testid="defuse-progress">
          Safe cuts · {state.safeCuts}
        </span>
        {dealt && (
          <Timer
            seconds={params.timerSeconds}
            running={!gameOver}
            onExpire={handleTimerExpire}
            audible
          />
        )}
      </StatusZone>

      <ChallengeZone>
        {!dealt ? (
          <div className="mg-setup-panel" data-testid="defuse-setup">
            <div className="mg-setup-panel__title">
              <Hand size={16} />
              Set up the table
            </div>
            <ol className="mg-setup-panel__steps">
              <li>Shuffle the pack and deal <strong>{params.wireCount} cards face-up in a row</strong> — these are the wires.</li>
              <li>Hand the player-view screen to the reader. <strong>They must not see the cards.</strong></li>
              <li>The crew must not see the reader's rules — they describe the row, the reader names the cuts.</li>
            </ol>
            <p className="mg-setup-panel__rule">
              A named wire is cut by flipping it face-down. You can see both the row and the rules
              below — record each cut, and declare all clear when every matching wire is face-down.
              Only yes/no answers between crew and reader; Clear Channel buys one full sentence.
            </p>
            <button
              type="button"
              className="mg-call-outcome-btn"
              data-testid="defuse-dealt"
              onClick={() => setDealt(true)}
            >
              Wires dealt — start the clock
            </button>
          </div>
        ) : (
          <>
            <div className={`ctb-subtext${state.wrongCut ? ' ctb-subtext--danger' : ''}`} data-testid="defuse-status-line">
              {state.wrongCut
                ? 'A cut matched no rule — the alarm is ringing.'
                : state.allClear
                  ? 'Every matching wire cut. Defused.'
                  : 'Check each named cut against the rules. Flip the card; record it below.'}
            </div>

            {!gameOver && (
              <div className="mg-record-controls" data-testid="defuse-record-controls">
                <button
                  type="button"
                  className="mg-tbtn"
                  data-testid="defuse-safe-cut"
                  onClick={handleSafeCut}
                >
                  <span className="mg-tl">✓</span>
                  <span className="mg-ts">Safe cut</span>
                </button>
                <button
                  type="button"
                  className="mg-tbtn mg-tbtn--danger"
                  data-testid="defuse-wrong-cut"
                  onClick={handleWrongCut}
                >
                  <span className="mg-tl">✗</span>
                  <span className="mg-ts">Wrong cut</span>
                </button>
                <button
                  type="button"
                  className="mg-tbtn mg-tbtn--ghost"
                  data-testid="defuse-all-clear"
                  onClick={handleAllClear}
                >
                  All clear
                </button>
              </div>
            )}

            {state.clearChannelUsed && (
              <div data-testid="defuse-clear-channel-active" className="dfz-manual-ref" style={{ color: 'var(--caution, #f7b84b)' }}>
                <MessageSquare size={14} />
                Clear Channel active — one full sentence allowed
              </div>
            )}

            {/* GM-only rulebook (glanceable reference) */}
            <details style={{ marginTop: '0.75rem' }} open>
              <summary data-testid="defuse-rulebook-toggle" style={{ cursor: 'pointer', color: 'var(--fg-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <BookOpen size={14} /> Rules (GM only — the crew can't see this screen)
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
          </>
        )}
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
