import { useState, useRef, useEffect } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { useMetronome, useAudioClock, useScheduleBeep } from '@/minigames/primitives';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { Beat16Params } from './generate';
import { judge, inTheBonesBoost } from './judge';
import type { Beat16State } from './judge';

function initState(): Beat16State {
  return { tapTimestampMs: null, measuredDeltaMs: null, boostUsed: false };
}

type FeedbackKind = 'on-the-beat' | 'early' | 'late' | 'recorded' | null;

function classifyFeedback(
  delta: number | null,
  cleanWindowMs: number,
  complicationWindowMs: number,
): FeedbackKind {
  if (delta === null) return 'recorded';
  const abs = Math.abs(delta);
  if (abs <= cleanWindowMs) return 'on-the-beat';
  if (abs <= complicationWindowMs) return delta < 0 ? 'early' : 'late';
  return delta < 0 ? 'early' : 'late';
}

export function Beat16Component({
  params,
  committed,
  onResolve,
}: MiniGameProps<Beat16Params>): JSX.Element {
  const [state, setState] = useState<Beat16State>(initState);

  const effectiveAudibleBeats = params.audibleBeats + (state.boostUsed ? 2 : 0);
  const clock = useAudioClock();
  const scheduleBeep = useScheduleBeep();
  const metronome = useMetronome({ bpm: params.bpm, audibleBeats: effectiveAudibleBeats, clock, scheduleBeep });

  const [currentBeat, setCurrentBeat] = useState(0);
  const beat1TimestampRef = useRef<number | null>(null);
  const boostKeyRef = useRef(state.boostUsed);

  useEffect(() => {
    if (boostKeyRef.current !== state.boostUsed) {
      boostKeyRef.current = state.boostUsed;
      beat1TimestampRef.current = null;
      setCurrentBeat(0);
    }
  }, [state.boostUsed]);

  metronome.onBeat((beatNumber: number) => {
    if (beatNumber === 1) {
      beat1TimestampRef.current = performance.now();
    }
    setCurrentBeat(beatNumber);
  });

  const hasTapped = state.tapTimestampMs !== null;

  function handleTap() {
    if (hasTapped) return;
    const now = performance.now();
    const beat1Time = beat1TimestampRef.current;
    let delta: number | null = null;
    if (beat1Time !== null) {
      const beatIntervalMs = 60000 / params.bpm;
      const expectedTargetBeatTime = beat1Time + (params.targetBeat - 1) * beatIntervalMs;
      delta = now - expectedTargetBeatTime;
    }
    setState({ ...state, tapTimestampMs: now, measuredDeltaMs: delta });
  }

  function handleBoost(hook: BoostHook<Beat16State, Beat16Params>) {
    setState(s => hook.apply(s, params));
  }

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  const feedback = hasTapped
    ? classifyFeedback(state.measuredDeltaMs, params.cleanWindowMs, params.complicationWindowMs)
    : null;

  const displayBeat = hasTapped ? params.targetBeat : currentBeat;
  const isMuted = currentBeat > effectiveAudibleBeats && !hasTapped;
  const progressPct = params.targetBeat > 0 ? (displayBeat / params.targetBeat) * 100 : 0;

  return (
    <div data-testid="beat-16">
      <StatusZone>
        <span className="mg-status-badge mg-status-badge--active" data-testid="beat16-mode">
          {isMuted ? 'Muted' : 'Counting'}
        </span>

        <div className="mg-progress-bar" aria-label="Metronome progress">
          <div className="mg-progress-bar__label">
            <span data-testid="target-beat">
              {hasTapped
                ? `Landed on beat ${displayBeat} of ${params.targetBeat}`
                : `Beat ${displayBeat} of ${params.targetBeat}${isMuted ? ' · muted' : ''}`}
            </span>
            {' · '}
            <span data-testid="audible-beats">Audible: {effectiveAudibleBeats}</span>
          </div>
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill mg-progress-bar__fill--data"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>
      </StatusZone>

      <ChallengeZone>
        {/* Beat dots row — one dot per beat up to targetBeat */}
        <div className="b16-beatrow" data-testid="beat-dots" aria-label="Beat dots">
          {Array.from({ length: params.targetBeat }, (_, i) => {
            const beatNum = i + 1;
            const isDone = beatNum < displayBeat;
            const isOn = beatNum === displayBeat && !hasTapped;
            const isTarget = beatNum === params.targetBeat;
            const isMuteZone = beatNum > effectiveAudibleBeats;
            const classes = [
              'b16-dot',
              isDone ? 'b16-dot--done' : '',
              isOn ? 'b16-dot--on' : '',
              isTarget ? 'b16-dot--target' : '',
              isMuteZone && !isDone && !isOn ? 'b16-dot--mute' : '',
            ].filter(Boolean).join(' ');
            return <div key={beatNum} className={classes} data-testid={`beat-dot-${beatNum}`} />;
          })}
        </div>

        {/* Hero area: beat count + TAP button or feedback */}
        <div className="b16-hero">
          {!hasTapped ? (
            <>
              <div className="b16-count" data-testid="beat-count">
                <span className="b16-num" data-testid="current-beat-num">{currentBeat || '—'}</span>
                <span className="b16-of">of {params.targetBeat}</span>
                {isMuted && <span className="b16-muted-label" data-testid="audible-beats">muted</span>}
              </div>
              <button
                data-testid="btn-tap"
                className="mg-big-tap"
                onClick={handleTap}
                disabled={hasTapped}
              >
                TAP
                <span className="b16-tap-sub">On beat {params.targetBeat}</span>
              </button>
            </>
          ) : (
            <div className="b16-feedback-area" data-testid="tap-result">
              {feedback === 'on-the-beat' && (
                <div className="b16-feedback b16-feedback--hit">On the beat</div>
              )}
              {feedback === 'early' && (
                <div className="b16-feedback b16-feedback--early">Early</div>
              )}
              {feedback === 'late' && (
                <div className="b16-feedback b16-feedback--late">Late</div>
              )}
              {feedback === 'recorded' && (
                <div className="b16-feedback b16-feedback--recorded">Tap recorded</div>
              )}
              <div className="b16-feedback-sub">
                {state.measuredDeltaMs !== null
                  ? `${state.measuredDeltaMs > 0 ? '+' : ''}${state.measuredDeltaMs.toFixed(0)} ms · suggest ${judge(state, params)}`
                  : 'Timing unavailable'}
              </div>
            </div>
          )}
        </div>
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<Beat16State, Beat16Params>
            hook={inTheBonesBoost}
            gameLanes={['physical']}
            committed={committed}
            onFire={handleBoost}
          />
        </div>
        <button
          type="button"
          data-testid="btn-call-outcome"
          className="mg-call-outcome-btn"
          onClick={handleCallOutcome}
        >
          Call Outcome
        </button>
      </RefereeZone>
    </div>
  );
}
