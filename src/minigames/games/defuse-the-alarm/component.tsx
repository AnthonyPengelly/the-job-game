import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Eye, BookOpen, MessageSquare } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import { publishSlice } from '@/platform/channel';
import type { DefuseParams, WireCard } from './generate';
import { judge, clearChannelBoost } from './judge';
import type { DefuseState } from './judge';

// Symbol emoji map for readable display
const SYMBOL_GLYPH: Record<string, string> = {
  circle: '●',
  square: '■',
  triangle: '▲',
  star: '★',
};

// Color shorthand for card display
const COLOR_ABBR: Record<string, string> = {
  red: 'RED',
  blue: 'BLU',
  green: 'GRN',
  yellow: 'YLW',
  orange: 'ORG',
  white: 'WHT',
};

const COLOR_STYLE: Record<string, React.CSSProperties> = {
  red: { color: 'var(--c-red-400, #f87171)' },
  blue: { color: 'var(--data, #00bcd4)' },
  green: { color: 'var(--accent, #1fd06e)' },
  yellow: { color: 'var(--caution, #f7b84b)' },
  orange: { color: 'var(--c-amber-300, #fde68a)' },
  white: { color: 'var(--fg, #eef4f1)' },
};

function initState(): DefuseState {
  return {
    cutIds: [],
    timerExpired: false,
    clearChannelUsed: false,
  };
}

function WireCardView({
  wire,
  position,
  isCut,
  isBadCut,
  isNextCorrect,
  onClick,
}: {
  wire: WireCard;
  position: number;
  isCut: boolean;
  isBadCut: boolean;
  isNextCorrect: boolean;
  onClick: () => void;
}): JSX.Element {
  const stateClass = isBadCut
    ? ' dfz-card--badcut'
    : isCut
    ? ' dfz-card--cut'
    : isNextCorrect
    ? ' dfz-card--correct'
    : '';

  return (
    <div
      className={`dfz-card${stateClass}`}
      data-testid={`wire-card-${wire.id}`}
      onClick={isCut || isBadCut ? undefined : onClick}
      role={isCut || isBadCut ? undefined : 'button'}
      aria-label={`Wire ${position}: ${wire.color} ${wire.symbol}`}
    >
      <div className="dfz-card-face">
        <span
          className="dfz-card-color"
          style={COLOR_STYLE[wire.color]}
        >
          {COLOR_ABBR[wire.color] ?? wire.color.toUpperCase().slice(0, 3)}
        </span>
        <span className="dfz-card-symbol" style={COLOR_STYLE[wire.color]}>
          {SYMBOL_GLYPH[wire.symbol] ?? wire.symbol}
        </span>
      </div>
      <span className="dfz-card-pos" data-testid={`wire-pos-${wire.id}`}>
        {position}{isBadCut ? ' · cut!' : isCut ? ' · cut' : isNextCorrect ? ' · next' : ''}
      </span>
    </div>
  );
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

  // Find the next safe wire to cut (first uncut safe wire in order)
  const nextCorrectId = params.safeWireIds.find(id => !state.cutIds.includes(id));
  const nextCorrectWire = nextCorrectId ? params.wires.find(w => w.id === nextCorrectId) : undefined;
  const nextCorrectPosition = nextCorrectWire
    ? params.wires.findIndex(w => w.id === nextCorrectId) + 1
    : undefined;

  let badgeClass = 'mg-status-badge mg-status-badge--active';
  let badgeIcon: React.ReactNode = null;
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
    badgeClass = 'mg-status-badge mg-status-badge--clean';
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

  // GM-only resolution: describe the next correct cut or the alarm state
  const gmResolutionText = alarmTripped
    ? `Wrong cut made — alarm tripped. ${wrongCutIds.length} bad cut${wrongCutIds.length !== 1 ? 's' : ''}.`
    : allSafeDone
    ? 'All safe cuts made — device defused.'
    : nextCorrectWire && nextCorrectPosition !== undefined
    ? `Next: cut position ${nextCorrectPosition} — ${nextCorrectWire.color} ${nextCorrectWire.symbol}.`
    : 'No safe wires remain to cut.';

  return (
    <div data-testid="defuse-the-alarm">
      <StatusZone>
        <span className={badgeClass}>
          {badgeIcon}
          <span>{badgeLabel}</span>
        </span>
        <div className="mg-progress-bar" data-testid="defuse-progress-bar">
          <div className="mg-progress-bar__track">
            <div
              className={`mg-progress-bar__fill mg-progress-bar__fill--data${alarmTripped ? ' mg-progress-bar__fill--danger' : ''}`}
              style={{ width: `${fillPct}%` }}
              data-testid="defuse-progress-fill"
            />
          </div>
          <span className="mg-progress-bar__label" data-testid="defuse-progress">
            Safe cuts · {safeCutsDone} / {params.safeWireIds.length}
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
        <div className="dfz-device" data-testid="defuse-wires">
          {params.wires.map((wire, i) => {
            const isCut = state.cutIds.includes(wire.id) && params.safeWireIds.includes(wire.id);
            const isBadCut = state.cutIds.includes(wire.id) && !params.safeWireIds.includes(wire.id);
            const isNextCorrect = !alarmTripped && wire.id === nextCorrectId && !state.cutIds.includes(wire.id);
            return (
              <WireCardView
                key={wire.id}
                wire={wire}
                position={i + 1}
                isCut={isCut}
                isBadCut={isBadCut}
                isNextCorrect={isNextCorrect}
                onClick={() => handleCut(wire.id)}
              />
            );
          })}
        </div>

        {/* GM-only resolution indicator */}
        <div
          data-testid="defuse-gm-resolution"
          className={`dfz-gmcut${alarmTripped ? ' dfz-gmcut--danger' : ''}`}
        >
          {alarmTripped
            ? <AlertTriangle size={16} className="dfz-gmcut-icon" />
            : <Eye size={16} className="dfz-gmcut-icon" />
          }
          <div>
            <div className="dfz-gmcut-label">
              {alarmTripped ? 'Mis-cut · GM only' : 'Manual resolves to · GM only'}
            </div>
            <div className="dfz-gmcut-text" data-testid="defuse-gm-text">
              {gmResolutionText}
            </div>
          </div>
        </div>

        {state.clearChannelUsed && (
          <div data-testid="defuse-clear-channel-active" className="dfz-manual-ref" style={{ color: 'var(--caution, #f7b84b)' }}>
            <MessageSquare size={14} />
            Clear Channel active — one full sentence allowed
          </div>
        )}

        {/* Player-view note */}
        <div className="dfz-manual-ref" data-testid="defuse-manual-ref">
          <BookOpen size={14} />
          Player-view holds the manual · crew describes this row, reader names the cut
        </div>

        {/* GM-only rulebook (glanceable reference) */}
        <details style={{ marginTop: '0.5rem' }}>
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
