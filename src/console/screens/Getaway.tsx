import { useEffect, useRef, useState } from 'react';
import { Check, Banknote, SkipForward, RotateCw, Play, Pause } from 'lucide-react';
import { useGameStore } from '@/console/store';
import { getawayBrief } from '@/engine';
import { publishSlice } from '@/platform/channel';
import { Teleprompter } from '@/console/teleprompter';
import { ActionBar, Button } from '@/console/ui';
import { useAudio } from '@/console/audio';

/**
 * Getaway referee screen — decluttered hero-clock layout.
 *
 * Two visual states driven by `timerActive`:
 *  ARMED (timerActive=false): clock shown ready (fg-faint, not ticking),
 *    controls enabled per CLAUDE.md rule 1 (no dead-ends), START CTA.
 *  ACTIVE (timerActive=true): clock is the hero — calm green while safe,
 *    danger red when ≤15 s remain. Round bar shows cleared progress meter.
 *
 * GM override buttons (Force win / Force bust) are always present.
 *
 * Narration lines are committed once at mount via script(). Next steps through
 * the committed sequence and disappears at the last line.
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

  // Narration lines committed once at mount.
  const [introLines] = useState<string[]>(() => director?.script('getawayIntro') ?? []);
  const [introIndex, setIntroIndex] = useState(0);
  const [countdownLines] = useState<string[]>(() => director?.script('getawayCountdown') ?? []);
  const [countdownIndex, setCountdownIndex] = useState(0);

  function handleIntroAdvance() {
    setIntroIndex(i => Math.min(i + 1, introLines.length - 1));
  }

  function handleCountdownAdvance() {
    setCountdownIndex(i => Math.min(i + 1, countdownLines.length - 1));
  }

  const introLine = introLines[introIndex] ?? '';
  const hasNextIntro = introIndex < introLines.length - 1;
  const countdownLine = countdownLines[countdownIndex] ?? '';
  const hasNextCountdown = countdownIndex < countdownLines.length - 1;

  const [cardsCleared, setCardsCleared] = useState(0);
  const clearedRef = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState(brief.timerSeconds);
  const [timerActive, setTimerActive] = useState(false);
  const [clueGiverIndex, setClueGiverIndex] = useState(0);

  // Starting skip count: one per power-up held across the whole crew (locked at mount).
  const [skipsLeft, setSkipsLeft] = useState(() =>
    crew.reduce((sum, p) => sum + Object.values(p.powerUps).filter(v => v === true).length, 0)
  );

  // Guard against double-dispatch if both timer + clear race.
  const resolvedRef = useRef(false);

  // Audio — null when no AudioProvider present (headless/tests).
  const audio = useAudio();
  // Stable ref so cleanup effects can reach the latest handle without stale closure.
  const audioRef = useRef(audio);
  audioRef.current = audio;
  // Track whether the tick loop is currently playing so we don't restart on every render.
  const tickPlayingRef = useRef(false);

  // ── Crew helpers ─────────────────────────────────────────────────────────────

  const currentClueGiverIdx = clueGiverIndex % crew.length;
  const currentPlayer = crew[currentClueGiverIdx];

  // ── Publish player-view slice ────────────────────────────────────────────────

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
      publishSlice({ kind: 'idle' });
    };
  }, []);

  // ── Audio: stop all looping getaway cues on unmount ──────────────────────────

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (!a) return;
      a.engine.stop('sfx-tick');
      a.engine.stop('finale-engine');
      a.engine.setChannelGain('heistSfx', 1.0);
    };
  }, []); // audioRef is stable — safe to omit from deps

  // ── Audio: start/stop tick and engine cue with timerActive ───────────────────

  useEffect(() => {
    if (!audio) return;
    if (timerActive) {
      // A short throttle rev marks the start, then the idle loop sits under it.
      audio.engine.play('finale-rev');
      audio.engine.play('finale-engine');
      if (!tickPlayingRef.current) {
        audio.engine.play('sfx-tick');
        tickPlayingRef.current = true;
      }
    } else {
      // Timer paused or not yet started — stop looping cues.
      if (tickPlayingRef.current) {
        audio.engine.stop('sfx-tick');
        tickPlayingRef.current = false;
      }
      audio.engine.stop('finale-engine');
      audio.engine.setChannelGain('heistSfx', 1.0);
    }
  }, [audio, timerActive]);

  // ── Audio: tighten tick intensity at near-bust ────────────────────────────────

  useEffect(() => {
    if (!audio || !timerActive) return;
    // Raise heistSfx channel gain at near-bust (≤15 s) to make the tick more urgent.
    audio.engine.setChannelGain('heistSfx', secondsLeft <= 15 ? 1.4 : 1.0);
  }, [audio, timerActive, secondsLeft]);

  // ── Countdown timer ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!timerActive) return;
    if (secondsLeft <= 0) {
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        setTimerActive(false);
        audio?.engine.stop('sfx-tick');
        audio?.engine.stop('finale-engine');
        audio?.engine.setChannelGain('heistSfx', 1.0);
        audio?.engine.play('sting-bust');
        dispatch({ t: 'RESOLVE_GETAWAY', win: false });
      }
      return;
    }
    const id = setTimeout(() => {
      setSecondsLeft(s => s - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [timerActive, secondsLeft, dispatch, audio]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  function handleCleared() {
    if (resolvedRef.current) return;
    // Synchronous ref count so rapid GM taps all land (state updates batch).
    clearedRef.current += 1;
    const next = clearedRef.current;
    setCardsCleared(next);
    setClueGiverIndex(i => i + 1);
    if (next >= brief.targetCards) {
      resolvedRef.current = true;
      setTimerActive(false);
      audio?.engine.stop('sfx-tick');
      audio?.engine.stop('finale-engine');
      audio?.engine.setChannelGain('heistSfx', 1.0);
      audio?.engine.play('sting-win');
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
    if (skipsLeft <= 0) return;
    setSkipsLeft(s => Math.max(0, s - 1));
    setClueGiverIndex(i => i + 1);
  }

  function handleForceWin() {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setTimerActive(false);
    audio?.engine.stop('sfx-tick');
    audio?.engine.stop('finale-engine');
    audio?.engine.setChannelGain('heistSfx', 1.0);
    audio?.engine.play('sting-win');
    dispatch({ t: 'RESOLVE_GETAWAY', win: true });
  }

  function handleForceBust() {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setTimerActive(false);
    audio?.engine.stop('sfx-tick');
    audio?.engine.stop('finale-engine');
    audio?.engine.setChannelGain('heistSfx', 1.0);
    audio?.engine.play('sting-bust');
    dispatch({ t: 'RESOLVE_GETAWAY', win: false });
  }

  function toggleTimer() {
    setTimerActive(a => !a);
  }

  // ── Derived display values ────────────────────────────────────────────────────

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTime = `${minutes}:${String(secs).padStart(2, '0')}`;

  const nearBust = timerActive && secondsLeft <= 15;

  let clockClass: string;
  if (!timerActive) {
    clockClass = 'gclock ready';
  } else if (nearBust) {
    clockClass = 'gclock danger';
  } else {
    clockClass = 'gclock calm';
  }

  const target = brief.targetCards;
  const clearedPct = target > 0 ? Math.min((cardsCleared / target) * 100, 100) : 0;

  const clockSub = !timerActive
    ? 'Clock ready · starts on START'
    : nearBust
      ? `Time draining · ${target - cardsCleared} card${target - cardsCleared !== 1 ? 's' : ''} left`
      : `Ticking · ${cardsCleared} of ${target} cleared`;

  return (
    <div data-testid="screen-getaway" className="stage-inner">

      {/* Narration: intro line */}
      {introLine !== '' && (
        <div data-testid="getaway-intro-narration">
          <Teleprompter line={introLine} hasNext={hasNextIntro} onAdvance={handleIntroAdvance} />
        </div>
      )}

      <div className="gaway">

        {/* Round bar: target · cleared (with meter) · skips left · reading clues */}
        <div className="roundbar" data-testid="getaway-roundbar">
          <div className="rc">
            <span className="k">Target</span>
            <span className="v" data-testid="target-cards">
              {target}
            </span>
          </div>
          <div className="rc">
            <span className="k">Cleared</span>
            <span className="v" data-testid="cards-cleared">
              {cardsCleared} <small>/ {target}</small>
            </span>
            <div className="meter">
              <div className="f" style={{ width: `${clearedPct}%` }} />
            </div>
          </div>
          <div className="rc">
            <span className="k">Skips left</span>
            <span className="v data" data-testid="skips-left">
              {skipsLeft} <small>from power-ups</small>
            </span>
          </div>
          <div className="rc">
            <span className="k">Reading clues</span>
            <div className="who">
              <RotateCw size={16} />
              <span className="nm" data-testid="clue-giver">Round the table</span>
            </div>
          </div>
        </div>

        {/* Hero clock */}
        <div className="clockzone">
          <div
            data-testid="timer-display"
            data-remaining={secondsLeft}
            className={clockClass}
          >
            {formattedTime}
          </div>
          <div className={`clock-sub${nearBust ? ' danger' : ''}`} data-testid="clock-sub">
            {clockSub}
          </div>
        </div>

        {/* Action controls — always enabled per golden rule #1 (no dead-ends) */}
        <div className="gctrls">
          <button
            type="button"
            className="gctrl cleared"
            data-testid="btn-cleared"
            onClick={handleCleared}
          >
            <Check />
            <span className="gl">Cleared</span>
            <span className="gs">+1 card</span>
          </button>

          <button
            type="button"
            className="gctrl skip"
            data-testid="btn-skip-card"
            onClick={handleSkipCard}
            disabled={skipsLeft <= 0}
          >
            <SkipForward />
            <span className="gl">Skip card</span>
            <span className="gs">{skipsLeft} left · 1 per power-up</span>
          </button>

          <button
            type="button"
            className="gctrl ditch"
            data-testid="btn-ditch"
            onClick={handleDitch}
          >
            <Banknote />
            <span className="gl">Ditch</span>
            <span className="gs">drop loot, skip</span>
          </button>

        </div>

        {/* GM overrides — always available (CLAUDE.md rule 1) */}
        <div className="gaway-overrides">
          <Button kind="primary" data-testid="btn-force-win" onClick={handleForceWin}>
            Force win
          </Button>
          <Button kind="danger" data-testid="btn-force-bust" onClick={handleForceBust}>
            Force bust
          </Button>
        </div>

      </div>

      {/* Narration: countdown tension line */}
      {countdownLine !== '' && (
        <div data-testid="getaway-countdown-narration">
          <Teleprompter line={countdownLine} hasNext={hasNextCountdown} onAdvance={handleCountdownAdvance} />
        </div>
      )}

      {/* Action bar: toggle timer */}
      <ActionBar
        left={
          timerActive ? (
            <Button
              kind="ghost"
              icon={Pause}
              data-testid="btn-toggle-timer"
              onClick={toggleTimer}
            >
              Pause
            </Button>
          ) : undefined
        }
        right={
          !timerActive ? (
            <Button
              kind="primary"
              size="lg"
              icon={Play}
              data-testid="btn-toggle-timer"
              onClick={toggleTimer}
            >
              Start
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
