import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useGameStore } from '@/console/store';
import { getawayBrief } from '@/engine';
import { publishSlice } from '@/platform/channel';
import { Teleprompter } from '@/console/teleprompter';
import { PhaseHead, Panel, Button } from '@/console/ui';

/**
 * Live Getaway referee screen — replaces GetawayStub.
 *
 * On mount computes the brief once (heat locked at call time per design).
 * Runs the round-the-circle Articulate game as a GM referee:
 *  - Counter: shows current clue-giver, cards cleared vs target.
 *  - Countdown timer: local state only — never in RunState (engine stays pure).
 *  - Cleared: increments cards-cleared + advances clue-giver.
 *  - Ditch: dispatches GETAWAY_DITCH (Heat tick, undoable), advances clue-giver.
 *  - Skip card: GM referee — advances clue-giver with no clear, no engine event.
 *  - Buy seconds: adds cfg.getaway.buySecondsBonus to the running countdown (GM referee).
 *  - Force win / Force bust: always available (golden rule #1, no dead-ends).
 *
 * Resolution:
 *  - cards-cleared reaches target → RESOLVE_GETAWAY { win: true }
 *  - timer hits 0              → RESOLVE_GETAWAY { win: false }
 */
export function Getaway() {
  const dispatch = useGameStore(s => s.dispatch);
  const cfg = useGameStore(s => s.cfg);
  const heat = useGameStore(s => s.session.present.heat);
  const crew = useGameStore(s => s.session.present.crew);
  const director = useGameStore(s => s.director);

  // Brief locked at mount time — difficulty does not change on GETAWAY_DITCH.
  const briefRef = useRef(getawayBrief(heat, cfg));
  const brief = briefRef.current;

  // Narration: getawayIntro and getawayCountdown picked once at mount.
  const [introLine, setIntroLine] = useState<string>(() =>
    director?.next('getawayIntro') ?? ''
  );
  const [countdownLine, setCountdownLine] = useState<string>(() =>
    director?.next('getawayCountdown') ?? ''
  );

  function handleIntroAdvance() {
    if (!director) return;
    setIntroLine(director.next('getawayIntro'));
  }

  function handleCountdownAdvance() {
    if (!director) return;
    setCountdownLine(director.next('getawayCountdown'));
  }

  const [cardsCleared, setCardsCleared] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(brief.timerSeconds);
  const [timerActive, setTimerActive] = useState(false);
  const [clueGiverIndex, setClueGiverIndex] = useState(0);

  // Guard against double-dispatch if both timer + clear race.
  const resolvedRef = useRef(false);

  // ── Crew helpers ─────────────────────────────────────────────────────────────

  const activeCrew = crew;
  const currentClueGiverIdx = clueGiverIndex % activeCrew.length;
  const currentPlayer = activeCrew[currentClueGiverIdx];

  // ── Publish player-view slice ────────────────────────────────────────────────
  // Publishes player-safe Getaway state to the player-view channel on every change.
  // Publishes idle on unmount (resolve or navigation away).

  useEffect(() => {
    publishSlice({
      kind: 'getaway',
      cardsCleared,
      targetCards: brief.targetCards,
      secondsRemaining: secondsLeft,
      clueGiverName: currentPlayer?.name ?? '',
      clueGiverIndex: currentClueGiverIdx,
      gameActive: timerActive,
    });
  }, [cardsCleared, secondsLeft, timerActive, clueGiverIndex, brief.targetCards, currentPlayer, currentClueGiverIdx]);

  useEffect(() => {
    return () => {
      // SEAM(E8/E9): teardown audio/narration on unmount.
      publishSlice({ kind: 'idle' });
    };
  }, []);

  // ── Countdown timer ──────────────────────────────────────────────────────────

  // SEAM(E8/E9): climax narration/sound — intro trigger on first start.
  // SEAM(E8/E9): countdown tick audio at each second while timerActive.

  useEffect(() => {
    if (!timerActive) return;
    if (secondsLeft <= 0) {
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        setTimerActive(false);
        // SEAM(E8/E9): bust sound/narration trigger here.
        dispatch({ t: 'RESOLVE_GETAWAY', win: false });
      }
      return;
    }
    const id = setTimeout(() => {
      setSecondsLeft(s => s - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [timerActive, secondsLeft, dispatch]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  function handleCleared() {
    if (resolvedRef.current) return;
    const next = cardsCleared + 1;
    setCardsCleared(next);
    setClueGiverIndex(i => i + 1);
    if (next >= brief.targetCards) {
      resolvedRef.current = true;
      setTimerActive(false);
      // SEAM(E8/E9): win sound/narration trigger here.
      dispatch({ t: 'RESOLVE_GETAWAY', win: true });
    }
  }

  function handleDitch() {
    if (resolvedRef.current) return;
    dispatch({ t: 'GETAWAY_DITCH' });
    setClueGiverIndex(i => i + 1);
  }

  function handleSkipCard() {
    if (resolvedRef.current) return;
    setClueGiverIndex(i => i + 1);
  }

  function handleBuySeconds() {
    if (resolvedRef.current) return;
    setSecondsLeft(s => s + cfg.getaway.buySecondsBonus);
  }

  function handleForceWin() {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setTimerActive(false);
    dispatch({ t: 'RESOLVE_GETAWAY', win: true });
  }

  function handleForceBust() {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setTimerActive(false);
    dispatch({ t: 'RESOLVE_GETAWAY', win: false });
  }

  function toggleTimer() {
    setTimerActive(a => !a);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTime = `${minutes}:${String(secs).padStart(2, '0')}`;

  // Clock is calm (green) when time is plentiful; danger (red) when ≤15s remain.
  const danger = secondsLeft <= 15;
  const clockClass = ['clock', !danger ? 'calm' : '', timerActive ? 'running' : '']
    .filter(Boolean)
    .join(' ');

  const heatPad = String(heat).padStart(2, '0');

  return (
    <div data-testid="screen-getaway" className="stage-inner">
      <PhaseHead
        eyebrow="05 · The Getaway"
        title="The Getaway"
        aside={`Heat ${heatPad} / ${cfg.heat.hMax}`}
      />

      {/* Narration: intro line at the start of the getaway */}
      {introLine !== '' && (
        <div data-testid="getaway-intro-narration">
          <Teleprompter line={introLine} onAdvance={handleIntroAdvance} />
        </div>
      )}

      {/* Big clock — the single glowing live element */}
      <div className="clock-wrap">
        <div
          data-testid="timer-display"
          data-remaining={secondsLeft}
          className={clockClass}
        >
          {formattedTime}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            kind={timerActive ? 'secondary' : 'primary'}
            size="lg"
            icon={timerActive ? Pause : Play}
            data-testid="btn-toggle-timer"
            onClick={toggleTimer}
          >
            {timerActive ? 'Pause' : 'Start'}
          </Button>
        </div>
      </div>

      {/* Brief display */}
      <Panel title="Round tracker" tag={`${cardsCleared} / ${brief.targetCards} cleared`}>
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="readout" style={{ flex: '0 0 auto' }}>
            <span className="k">Target</span>
            <span className="v" data-testid="target-cards">{brief.targetCards}</span>
          </div>
          <div className="readout" style={{ flex: '0 0 auto' }}>
            <span className="k">Cleared</span>
            <span className="v" data-testid="cards-cleared">
              {cardsCleared} / {brief.targetCards}
            </span>
          </div>
          <div className="readout" style={{ flex: '0 0 auto' }}>
            <span className="k">Clue-giver</span>
            <span className="v" style={{ fontSize: 28 }} data-testid="clue-giver">
              {currentPlayer?.name ?? '—'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button kind="primary" data-testid="btn-cleared" onClick={handleCleared}>
            Cleared
          </Button>
          <Button kind="danger" data-testid="btn-ditch" onClick={handleDitch}>
            Ditch (Heat +{cfg.getaway.ditchHeatCost})
          </Button>
          <Button kind="ghost" data-testid="btn-skip-card" onClick={handleSkipCard}>
            Skip card
          </Button>
          <Button kind="secondary" data-testid="btn-buy-seconds" onClick={handleBuySeconds}>
            Buy seconds (+{cfg.getaway.buySecondsBonus}s)
          </Button>
        </div>
      </Panel>

      {/* Narration: countdown/finale tension line */}
      {countdownLine !== '' && (
        <div data-testid="getaway-countdown-narration">
          <Teleprompter line={countdownLine} onAdvance={handleCountdownAdvance} />
        </div>
      )}

      {/* GM overrides — always available (golden rule #1) */}
      <Panel title="GM overrides" tag="always available">
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button kind="primary" data-testid="btn-force-win" onClick={handleForceWin}>
            Force win
          </Button>
          <Button kind="danger" data-testid="btn-force-bust" onClick={handleForceBust}>
            Force bust
          </Button>
        </div>
      </Panel>
    </div>
  );
}
