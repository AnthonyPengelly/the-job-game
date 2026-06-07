import { useState, useRef, useEffect } from 'react';
import { Eye, Zap, CheckCircle, XCircle } from 'lucide-react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { CardSpread } from '@/minigames/primitives/CardSpread';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { useMetronome, useAudioClock, useScheduleBeep } from '@/minigames/primitives';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { FollowTheCircuitParams } from './generate';
import type { FollowTheCircuitState } from './judge';
import { judge, photographicBoost, muscleMemoryBoost } from './judge';

type Phase = 'watching' | 'inputting' | 'done';

function initState(): FollowTheCircuitState {
  return {
    lengthReached: 0,
    chainBroke: false,
    fumbleForgiven: false,
    photographicUsed: false,
    muscleMemoryUsed: false,
    tapsThisRound: [],
  };
}

export function FollowTheCircuitComponent({
  params,
  committed,
  onResolve,
}: MiniGameProps<FollowTheCircuitParams>): JSX.Element {
  const [state, setState] = useState<FollowTheCircuitState>(initState);
  const [phase, setPhase] = useState<Phase>('watching');
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [currentRoundLength, setCurrentRoundLength] = useState(1);
  const [replayVersion, setReplayVersion] = useState(0);

  const effectivePlaybackSpeedMs = state.muscleMemoryUsed
    ? params.playbackSpeedMs * 2
    : params.playbackSpeedMs;
  const effectiveBpm = Math.round(60000 / effectivePlaybackSpeedMs);
  const audibleBeats = currentRoundLength;

  const clock = useAudioClock();
  const scheduleBeep = useScheduleBeep();
  const metronome = useMetronome({ bpm: effectiveBpm, audibleBeats, clock, scheduleBeep });

  const phaseRef = useRef<Phase>('watching');
  phaseRef.current = phase;
  const currentRoundLengthRef = useRef(currentRoundLength);
  currentRoundLengthRef.current = currentRoundLength;
  const stateRef = useRef(state);
  stateRef.current = state;

  const playbackStartBeatRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase === 'watching') {
      playbackStartBeatRef.current = null;
    }
  }, [phase, replayVersion]);

  metronome.onBeat((beatNumber: number) => {
    if (phaseRef.current !== 'watching') return;

    if (playbackStartBeatRef.current === null) {
      playbackStartBeatRef.current = beatNumber;
    }

    const indexInRound = beatNumber - playbackStartBeatRef.current;
    const roundLen = currentRoundLengthRef.current;

    if (indexInRound < roundLen) {
      setHighlightIndex(indexInRound);
    } else if (indexInRound === roundLen) {
      setHighlightIndex(null);
      playbackStartBeatRef.current = null;
      setPhase('inputting');
    }
  });

  const isDone = phase === 'done' || state.chainBroke;

  function handleCardTap(id: CardId) {
    if (phase !== 'inputting' || isDone) return;

    const currentSt = stateRef.current;
    const tapIndex = currentSt.tapsThisRound.length;
    const expected = params.sequence[tapIndex];
    const isCorrect = id === expected;

    if (isCorrect) {
      const newTaps = [...currentSt.tapsThisRound, id];
      if (newTaps.length < currentRoundLengthRef.current) {
        setState(s => ({ ...s, tapsThisRound: newTaps }));
      } else {
        const nextLength = currentRoundLengthRef.current + 1;
        if (currentRoundLengthRef.current >= params.targetLength) {
          setState(s => ({ ...s, lengthReached: params.targetLength, tapsThisRound: [] }));
          setPhase('done');
        } else {
          setState(s => ({
            ...s,
            lengthReached: currentRoundLengthRef.current,
            tapsThisRound: [],
          }));
          setCurrentRoundLength(nextLength);
          setPhase('watching');
        }
      }
    } else {
      if (currentSt.muscleMemoryUsed && !currentSt.fumbleForgiven) {
        setState(s => ({ ...s, fumbleForgiven: true, tapsThisRound: [] }));
        setPhase('watching');
      } else {
        setState(s => ({
          ...s,
          tapsThisRound: [...s.tapsThisRound, id],
          chainBroke: true,
        }));
        setPhase('done');
      }
    }
  }

  function handleBoost(
    hook: BoostHook<FollowTheCircuitState, FollowTheCircuitParams>,
  ) {
    const next = hook.apply(stateRef.current, params);
    if (next === stateRef.current) return;
    setState(next);
    if (hook.lane === 'tech' && !stateRef.current.photographicUsed) {
      setPhase('watching');
      setReplayVersion(v => v + 1);
    }
  }

  function handleCallOutcome() {
    onResolve(judge(state, params));
  }

  const faceDown: CardId[] =
    phase === 'watching' && highlightIndex !== null
      ? params.cards
          .filter(c => c.id !== params.sequence[highlightIndex])
          .map(c => c.id)
      : [];

  const progressText = `${state.lengthReached}/${params.targetLength}`;
  const roundProgress = Math.min(
    state.tapsThisRound.length / currentRoundLength,
    1,
  );

  // Status badge for current phase
  let phaseBadgeClass = 'mg-status-badge mg-status-badge--active';
  let phaseIcon: React.ReactNode = <Eye size={14} />;
  let phaseLabel = 'WATCH';

  if (phase === 'inputting') {
    phaseBadgeClass = 'mg-status-badge mg-status-badge--active';
    phaseIcon = <Zap size={14} />;
    phaseLabel = 'TAP';
  } else if (phase === 'done') {
    if (state.chainBroke) {
      phaseBadgeClass = 'mg-status-badge mg-status-badge--botched';
      phaseIcon = <XCircle size={14} />;
      phaseLabel = 'BROKE';
    } else {
      phaseBadgeClass = 'mg-status-badge mg-status-badge--clean';
      phaseIcon = <CheckCircle size={14} />;
      phaseLabel = 'DONE';
    }
  }

  return (
    <div data-testid="follow-the-circuit">
      <StatusZone>
        <span className={phaseBadgeClass}>
          {phaseIcon}
          <span data-testid="ftc-phase">{phaseLabel}</span>
        </span>
        <span data-testid="ftc-progress">Progress: {progressText}</span>
        {state.chainBroke && <span data-testid="ftc-broke">CHAIN BROKE</span>}
        {state.fumbleForgiven && <span data-testid="ftc-forgiven">fumble forgiven</span>}
        <div className="mg-progress-bar">
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill"
              style={{ width: `${roundProgress * 100}%` }}
            />
          </div>
          <div className="mg-progress-bar__label">
            {state.tapsThisRound.length}/{currentRoundLength}
          </div>
        </div>
      </StatusZone>

      <ChallengeZone>
        <div data-testid="ftc-taps">
          Taps this round: {state.tapsThisRound.length}/{currentRoundLength}
        </div>
        <CardSpread
          cards={params.cards}
          layout="grid"
          faceDown={faceDown}
          {...(phase === 'inputting' && !isDone ? { onTap: handleCardTap } : {})}
        />
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<FollowTheCircuitState, FollowTheCircuitParams>
            hook={photographicBoost}
            committed={committed}
            onFire={handleBoost}
          />
        </div>
        <div className="mg-boost-slot">
          <BoostButton<FollowTheCircuitState, FollowTheCircuitParams>
            hook={muscleMemoryBoost}
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
