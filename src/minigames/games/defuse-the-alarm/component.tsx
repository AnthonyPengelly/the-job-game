import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, BookOpen, Hand, MessageSquare, Laptop, Undo2 } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { Timer } from '@/minigames/primitives/Timer';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import { publishSlice } from '@/platform/channel';
import type { DefuseParams, WireCard, WireSuit } from './generate';
import { solveDeal } from './generate';
import { judge, insulatedGlovesBoost } from './judge';
import type { DefuseState } from './judge';

// ── GM card-input solver (wave 4) ─────────────────────────────────────────────
// GM-only: enter the dealt row, the app names which wires to cut and in what
// order. Used to check the crew's work at the end (and never shown on the
// reader's handoff screen).

const SOLVER_RANKS: ReadonlyArray<{ label: string; value: number }> = [
  { label: 'A', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
  { label: '4', value: 4 }, { label: '5', value: 5 }, { label: '6', value: 6 },
  { label: '7', value: 7 }, { label: '8', value: 8 }, { label: '9', value: 9 },
  { label: '10', value: 10 }, { label: 'J', value: 11 }, { label: 'Q', value: 12 },
  { label: 'K', value: 13 },
];
const SOLVER_SUITS: ReadonlyArray<{ label: string; value: WireSuit }> = [
  { label: '♣', value: 'clubs' }, { label: '♦', value: 'diamonds' },
  { label: '♥', value: 'hearts' }, { label: '♠', value: 'spades' },
];

function DefuseSolver({ params }: { params: DefuseParams }): JSX.Element {
  const [row, setRow] = useState<WireCard[]>(() =>
    Array.from({ length: params.wireCount }, () => ({ rank: 1, suit: 'clubs' as WireSuit })),
  );

  function setWire(i: number, patch: Partial<WireCard>) {
    setRow(prev => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  const { verdicts, cutOrder } = solveDeal(params.clauses, row);

  return (
    <div className="dfz-solver" data-testid="defuse-solver">
      <div className="dfz-solver-head">
        Enter the row to check the cuts — GM only
      </div>
      <div className="dfz-solver-row">
        {row.map((card, i) => (
          <div
            key={i}
            className={`dfz-solver-wire dfz-solver-wire--${verdicts[i]}`}
            data-testid={`defuse-solver-wire-${i}`}
          >
            <span className="dfz-solver-pos">{i + 1}</span>
            <select
              data-testid={`defuse-solver-rank-${i}`}
              value={card.rank}
              onChange={e => setWire(i, { rank: Number(e.target.value) })}
            >
              {SOLVER_RANKS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <select
              data-testid={`defuse-solver-suit-${i}`}
              value={card.suit}
              onChange={e => setWire(i, { suit: e.target.value as WireSuit })}
            >
              {SOLVER_SUITS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <span className="dfz-solver-verdict">{verdicts[i] === 'cut' ? 'CUT' : 'keep'}</span>
          </div>
        ))}
      </div>
      <div className="dfz-solver-answer" data-testid="defuse-solver-answer">
        {cutOrder.length === 0
          ? 'Cut nothing — every wire is safe.'
          : `Cut, left to right: ${cutOrder.map(p => `#${p}`).join(' → ')}`}
      </div>
    </div>
  );
}

function initState(): DefuseState {
  return {
    safeCuts: 0,
    wrongCut: false,
    allClear: false,
    timerExpired: false,
    glovesArmed: false,
    wrongCutForgiven: false,
  };
}

/**
 * Table modes (playtest wave 2 — one-laptop redesign):
 *   setup      — deal instructions; GM picks the path below.
 *   live       — two-device path: reader holds the player-view, GM keeps the
 *                console and records cuts live (the original flow).
 *   handoff    — one-laptop path: the console becomes a fullscreen READER view
 *                (rulebook + countdown only — no GM state). The crew plays the
 *                row physically; nobody adjudicates yet.
 *   adjudicate — the laptop is back with the GM, who checks the crew's flipped
 *                wires against the rules retrospectively (the bomb-squad
 *                "checking your work" moment) and records the result.
 */
type TableMode = 'setup' | 'live' | 'handoff' | 'adjudicate';

export function DefuseComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<DefuseParams>): JSX.Element {
  const [state, setState] = useState<DefuseState>(initState);
  const [mode, setMode] = useState<TableMode>('setup');

  // Publish only the rulebook slice to the player-view — never anything GM-only.
  useEffect(() => {
    publishSlice({
      kind: 'defuse-rulebook',
      rules: params.ruleLines,
      gameActive: true,
    });
    return () => {
      publishSlice({ kind: 'idle' });
    };
  }, [params]);

  const gameOver = state.wrongCut || state.allClear || state.timerExpired;

  let badgeClass = 'mg-status-badge mg-status-badge--active';
  let badgeIcon: React.ReactNode = null;
  let badgeLabel =
    mode === 'setup' ? 'Setup' : mode === 'adjudicate' ? 'Checking the work' : 'Defusing';

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
    if (state.wrongCut || state.allClear) return;
    setState(s => ({ ...s, safeCuts: s.safeCuts + 1 }));
  }

  function handleWrongCut() {
    if (state.wrongCut || state.allClear) return;
    setState(s =>
      // Pre-armed Insulated Gloves absorb the first wrong cut on the spot.
      s.glovesArmed && !s.wrongCutForgiven
        ? { ...s, glovesArmed: false, wrongCutForgiven: true }
        : { ...s, wrongCut: true },
    );
  }

  function handleAllClear() {
    if (state.wrongCut || state.allClear) return;
    setState(s => ({ ...s, allClear: true }));
  }

  function handleTimerExpire() {
    setState(s => ({ ...s, timerExpired: true }));
    // One-laptop path: the clock ran out in the reader's hands — bring it back.
    setMode(m => (m === 'handoff' ? 'adjudicate' : m));
  }

  function handleBoost(hook: BoostHook<DefuseState, DefuseParams>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state));
  }

  // ── HANDOFF: fullscreen reader view — rulebook + countdown ONLY ────────────
  // Sanctioned reader exception (MINIGAMES.md §6.10): the console temporarily
  // becomes the rulebook. No GM state, no recording controls, nothing the
  // reader shouldn't see. The crew still must not look — the reader holds it.
  if (mode === 'handoff') {
    // Portal to <body>: the cockpit work area's mask/stacking context would
    // otherwise trap position:fixed and leave the HUD/crew rail visible —
    // the handed-over laptop must show the rulebook and nothing else.
    return createPortal(
      <div className="dfz-reader-overlay" data-testid="defuse-reader-overlay">
        <div className="dfz-reader-head">
          <BookOpen size={20} aria-hidden />
          <span className="dfz-reader-title">READER ONLY</span>
          <span className="dfz-reader-sub">
            Crew — eyes on the wires. Describe the row out loud; the reader names the cuts.
          </span>
        </div>
        <ol className="dfz-reader-rules" data-testid="defuse-reader-rules">
          {params.ruleLines.map((line, i) => (
            <li key={i} data-testid={`defuse-reader-rule-${i}`}>{line}</li>
          ))}
        </ol>
        <div className="dfz-reader-foot">
          <Timer
            seconds={params.timerSeconds}
            running={!gameOver}
            onExpire={handleTimerExpire}
            audible
          />
          <button
            type="button"
            className="mg-call-outcome-btn"
            data-testid="defuse-handback"
            onClick={() => setMode('adjudicate')}
          >
            <Undo2 size={16} aria-hidden /> Done — hand the laptop back
          </button>
        </div>
      </div>,
      document.body,
    );
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
        {mode === 'live' && (
          <Timer
            seconds={params.timerSeconds}
            running={!gameOver}
            onExpire={handleTimerExpire}
            audible
          />
        )}
        {mode === 'adjudicate' && state.timerExpired && (
          <span className="mg-dial-inline" data-testid="defuse-time-ran-out" style={{ color: 'var(--danger, #e5484d)' }}>
            The clock hit zero before they finished
          </span>
        )}
      </StatusZone>

      <ChallengeZone>
        {mode === 'setup' && (
          <div className="mg-setup-panel" data-testid="defuse-setup">
            <div className="mg-setup-panel__title">
              <Hand size={16} />
              Set up the table
            </div>
            <ol className="mg-setup-panel__steps">
              <li>Shuffle the pack and deal <strong>{params.wireCount} cards face-up in a row</strong> — these are the wires.</li>
              <li>Pick a <strong>reader</strong>. They get the rules; they must not see the cards. The crew describes the row; the reader names the cuts. A named wire is cut by flipping it face-down.</li>
              <li>Only yes/no answers between crew and reader. Insulated Gloves (power-up shout) forgives one wrong cut.</li>
            </ol>
            <p className="mg-setup-panel__rule">
              <strong>Two ways to run it:</strong> if a second screen is connected, the reader
              uses the player-view and you referee live. With <strong>one laptop</strong>, hand
              this machine to the reader — it shows only the rulebook and the clock; when the
              row is done it comes back to you and you check their work.
            </p>
            <div className="dfz-setup-actions">
              <button
                type="button"
                className="mg-call-outcome-btn"
                data-testid="defuse-dealt"
                onClick={() => setMode('live')}
              >
                Reader has a second screen — start the clock
              </button>
              <button
                type="button"
                className="mg-call-outcome-btn"
                data-testid="defuse-handoff"
                onClick={() => setMode('handoff')}
              >
                <Laptop size={16} aria-hidden /> One laptop — hand it to the reader
              </button>
            </div>
          </div>
        )}

        {(mode === 'live' || mode === 'adjudicate') && (
          <>
            <div className={`ctb-subtext${state.wrongCut ? ' ctb-subtext--danger' : ''}`} data-testid="defuse-status-line">
              {state.wrongCut
                ? 'A cut no rule allows — the alarm is ringing.'
                : state.allClear
                  ? 'Every wire the rules demand is cut, and nothing else. Defused.'
                  : mode === 'adjudicate'
                    ? 'Walk the row against the rules: ✓ each correctly cut wire, ✗ the moment a flipped wire breaks the rules, all clear if the row is perfect.'
                    : 'Check each named cut against the rules. Flip the card; record it below.'}
            </div>

            {!state.wrongCut && !state.allClear && (
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

            {state.glovesArmed && (
              <div data-testid="defuse-gloves-armed" className="dfz-manual-ref" style={{ color: 'var(--caution, #f7b84b)' }}>
                <MessageSquare size={14} />
                Insulated Gloves armed — the next wrong cut won't trip the alarm
              </div>
            )}
            {state.wrongCutForgiven && (
              <div data-testid="defuse-gloves-used" className="dfz-manual-ref" style={{ color: 'var(--caution, #f7b84b)' }}>
                <MessageSquare size={14} />
                A wrong cut was absorbed — best result now: complication
              </div>
            )}

            {/* GM-only rulebook (glanceable reference) */}
            <details style={{ marginTop: '0.75rem' }} open>
              <summary data-testid="defuse-rulebook-toggle" style={{ cursor: 'pointer', color: 'var(--fg-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <BookOpen size={14} /> Rules (GM only — the crew can't see this screen)
              </summary>
              <div data-testid="defuse-rulebook-gm" style={{ marginTop: '0.5rem' }}>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {params.ruleLines.map((line, i) => (
                    <li key={i} data-testid={`defuse-gm-rule-${i}`} style={{ fontSize: '0.9rem', color: 'var(--fg)' }}>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </details>

            {/* GM card-input solver — check the row, get the cut order. */}
            <details style={{ marginTop: '0.75rem' }}>
              <summary data-testid="defuse-solver-toggle" style={{ cursor: 'pointer', color: 'var(--fg-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <BookOpen size={14} /> Solver — enter the row to see the cuts
              </summary>
              <DefuseSolver params={params} />
            </details>
          </>
        )}
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<DefuseState, DefuseParams>
            hook={insulatedGlovesBoost}
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
