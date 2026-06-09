import { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Clock, XCircle } from 'lucide-react';
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

type FeedbackKind = 'hit' | 'close' | 'miss' | 'recorded' | null;

function classifyFeedback(
  delta: number | null,
  cleanWindowMs: number,
  complicationWindowMs: number,
): FeedbackKind {
  if (delta === null) return 'recorded';
  const abs = Math.abs(delta);
  if (abs <= cleanWindowMs) return 'hit';
  if (abs <= complicationWindowMs) return 'close';
  return 'miss';
}

export function Beat16Component({
  params,
  committed,
  onResolve,
}: MiniGameProps<Beat16Params>): JSX.Element {
  const [state, setState] = useState<Beat16State>(initState);

  // Re-run the metronome from scratch when the boost adds 2 extra audible beats.
  const effectiveAudibleBeats = params.audibleBeats + (state.boostUsed ? 2 : 0);
  const clock = useAudioClock();
  const scheduleBeep = useScheduleBeep();
  const metronome = useMetronome({ bpm: params.bpm, audibleBeats: effectiveAudibleBeats, clock, scheduleBeep });

  // Track when beat 1 fires so we can compute expected target-beat time.
  const beat1TimestampRef = useRef<number | null>(null);
  // Track the most recent reset key so the component can detect boost-triggered restart.
  const boostKeyRef = useRef(state.boostUsed);

  // Reset timing when the boost fires (audibleBeats changes → metronome restarts).
  useEffect(() => {
    if (boostKeyRef.current !== state.boostUsed) {
      boostKeyRef.current = state.boostUsed;
      beat1TimestampRef.current = null;
    }
  }, [state.boostUsed]);

  // Register beat callback.
  metronome.onBeat((beatNumber: number) => {
    if (beatNumber === 1) {
      beat1TimestampRef.current = performance.now();
    }
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
    const nextState: Beat16State = { ...state, tapTimestampMs: now, measuredDeltaMs: delta };
    setState(nextState);
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

  return (
    <div data-testid="beat-16">
      <StatusZone>
        <span data-testid="target-beat">Count to: {params.targetBeat}</span>
        <span> | BPM: {params.bpm}</span>
        <span data-testid="audible-beats"> | Audible: {effectiveAudibleBeats}</span>
      </StatusZone>

      <ChallengeZone>
        <button
          data-testid="btn-tap"
          className="mg-big-tap"
          onClick={handleTap}
          disabled={hasTapped}
        >
          TAP
        </button>

        {hasTapped && (
          <div data-testid="tap-result">
            {state.measuredDeltaMs !== null
              ? `Delta: ${state.measuredDeltaMs.toFixed(0)} ms`
              : 'Tap recorded (timing unavailable)'}
          </div>
        )}

        {feedback === 'hit' && (
          <span className="mg-status-badge mg-status-badge--clean">
            <ShieldCheck size={14} /> HIT
          </span>
        )}
        {feedback === 'close' && (
          <span className="mg-status-badge mg-status-badge--complication">
            <Clock size={14} /> CLOSE
          </span>
        )}
        {feedback === 'miss' && (
          <span className="mg-status-badge mg-status-badge--botched">
            <XCircle size={14} /> MISS
          </span>
        )}
        {feedback === 'recorded' && (
          <span className="mg-status-badge mg-status-badge--active">
            Tap recorded
          </span>
        )}
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
