import { useState, useRef, useEffect } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { useMetronome, useAudioClock, useScheduleBeep } from '@/minigames/primitives';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { StatusZone, ChallengeZone, RefereeZone } from '@/minigames/primitives/MinigameShell';
import type { FollowTheCircuitParams } from './generate';
import type { FollowTheCircuitState } from './judge';
import { judge, photographicBoost } from './judge';

type Phase = 'watching' | 'inputting' | 'done';

function initState(): FollowTheCircuitState {
  return {
    lengthReached: 0,
    chainBroke: false,
    photographicUsed: false,
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

  const effectiveBpm = Math.round(60000 / params.playbackSpeedMs);
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

  function handleCellTap(id: CardId) {
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
      setState(s => ({
        ...s,
        tapsThisRound: [...s.tapsThisRound, id],
        chainBroke: true,
      }));
      setPhase('done');
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

  // Progress
  const progressPct = params.targetLength > 0
    ? (state.lengthReached / params.targetLength) * 100
    : 0;
  const roundProgressPct = currentRoundLength > 0
    ? (state.tapsThisRound.length / currentRoundLength) * 100
    : 0;

  // Phase label for status
  let phaseLabel = 'Watch';
  let phaseBadgeClass = 'mg-status-badge mg-status-badge--active';
  if (phase === 'inputting') {
    phaseLabel = 'Your turn';
    phaseBadgeClass = 'mg-status-badge mg-status-badge--clean';
  } else if (phase === 'done') {
    phaseLabel = state.chainBroke ? 'Broke' : 'Done';
    phaseBadgeClass = state.chainBroke
      ? 'mg-status-badge mg-status-badge--botched'
      : 'mg-status-badge mg-status-badge--clean';
  }

  // Build cell states for the 4-card Simon grid
  const watchingHighlightId =
    phase === 'watching' && highlightIndex !== null
      ? params.sequence[highlightIndex]
      : null;

  const tappedIds = new Set(state.tapsThisRound);

  return (
    <div data-testid="follow-the-circuit">
      <StatusZone>
        <span className={phaseBadgeClass} data-testid="ftc-phase">
          {phaseLabel}
        </span>

        <div className="mg-progress-bar" aria-label="Sequence length">
          <div className="mg-progress-bar__label">
            <span data-testid="ftc-progress">
              {phase === 'inputting'
                ? `Repeating · ${state.tapsThisRound.length} / ${currentRoundLength}`
                : `Sequence · ${state.lengthReached} / ${params.targetLength}`}
            </span>
            {state.chainBroke && <span data-testid="ftc-broke"> · CHAIN BROKE</span>}
          </div>
          <div className="mg-progress-bar__track">
            <div
              className="mg-progress-bar__fill mg-progress-bar__fill--data"
              style={{
                width: `${phase === 'inputting' ? roundProgressPct : progressPct}%`,
              }}
            />
          </div>
        </div>
      </StatusZone>

      <ChallengeZone>
        {/* Simon grid — 2×2 for the 4 circuit nodes */}
        <div className="ftc-grid" data-testid="ftc-grid">
          {params.cards.map(card => {
            const isWatching = card.id === watchingHighlightId;
            const isTapped = tappedIds.has(card.id);
            const isInteractive = phase === 'inputting' && !isDone;

            const cellClasses = [
              'ftc-cell',
              isWatching ? 'ftc-cell--watch' : '',
              isTapped ? 'ftc-cell--tapped' : '',
              isInteractive ? 'ftc-cell--interactive' : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                key={card.id}
                type="button"
                className={cellClasses}
                data-testid={`ftc-cell-${card.id}`}
                onClick={() => handleCellTap(card.id)}
                disabled={!isInteractive}
              >
                {card.label}
              </button>
            );
          })}
        </div>

        {/* Sub-text describing current state */}
        <div
          className={`ftc-subtext${phase === 'watching' ? ' ftc-subtext--data' : ''}`}
          data-testid="ftc-subtext"
        >
          {phase === 'watching' && highlightIndex !== null &&
            `Showing step ${highlightIndex + 1} of ${currentRoundLength}`}
          {phase === 'watching' && highlightIndex === null && 'Watch the sequence…'}
          {phase === 'inputting' &&
            `${state.tapsThisRound.length} of ${currentRoundLength} correct · a wrong tap ends the run`}
          {phase === 'done' && !state.chainBroke && 'Target reached!'}
          {phase === 'done' && state.chainBroke && 'Wrong tap — chain broken.'}
        </div>
      </ChallengeZone>

      <RefereeZone>
        <div className="mg-boost-slot">
          <BoostButton<FollowTheCircuitState, FollowTheCircuitParams>
            hook={photographicBoost}
            gameLanes={['tech', 'physical']}
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
