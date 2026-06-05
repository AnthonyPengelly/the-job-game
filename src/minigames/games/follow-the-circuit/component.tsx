import { useState, useRef, useEffect } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { CardSpread } from '@/minigames/primitives/CardSpread';
import type { CardId } from '@/minigames/primitives/CardSpread';
import { useMetronome } from '@/minigames/primitives/Metronome';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
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
  // currentRoundLength: the sequence length currently being shown/inputted.
  const [currentRoundLength, setCurrentRoundLength] = useState(1);
  // replayVersion increments when Photographic fires, forcing the Metronome to restart.
  const [replayVersion, setReplayVersion] = useState(0);

  // Effective playback speed: halved (slower) when Muscle Memory is active.
  const effectivePlaybackSpeedMs = state.muscleMemoryUsed
    ? params.playbackSpeedMs * 2
    : params.playbackSpeedMs;
  const effectiveBpm = Math.round(60000 / effectivePlaybackSpeedMs);
  // audibleBeats controls how many beats the Metronome fires sound for.
  // We use currentRoundLength + 1 to give a small gap beat after the sequence ends.
  const audibleBeats = currentRoundLength;

  const metronome = useMetronome({ bpm: effectiveBpm, audibleBeats });

  // Stable refs so the onBeat callback always sees current values.
  const phaseRef = useRef<Phase>('watching');
  phaseRef.current = phase;
  const currentRoundLengthRef = useRef(currentRoundLength);
  currentRoundLengthRef.current = currentRoundLength;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track which beat the current watching session started at.
  const playbackStartBeatRef = useRef<number | null>(null);

  // Reset playback start beat whenever we (re-)enter watching phase.
  useEffect(() => {
    if (phase === 'watching') {
      playbackStartBeatRef.current = null;
    }
  }, [phase, replayVersion]);

  // Register beat callback for sequence playback.
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
      // Sequence fully shown — switch to input phase.
      setHighlightIndex(null);
      playbackStartBeatRef.current = null;
      setPhase('inputting');
    }
  });

  const isDone = phase === 'done' || state.chainBroke;
  const suggested = judge(state, params);

  function handleCardTap(id: CardId) {
    if (phase !== 'inputting' || isDone) return;

    const currentSt = stateRef.current;
    const tapIndex = currentSt.tapsThisRound.length;
    const expected = params.sequence[tapIndex];
    const isCorrect = id === expected;

    if (isCorrect) {
      const newTaps = [...currentSt.tapsThisRound, id];
      if (newTaps.length < currentRoundLengthRef.current) {
        // More taps to go in this round.
        setState(s => ({ ...s, tapsThisRound: newTaps }));
      } else {
        // Round complete.
        const nextLength = currentRoundLengthRef.current + 1;
        if (currentRoundLengthRef.current >= params.targetLength) {
          // Reached the target — game over (success).
          setState(s => ({ ...s, lengthReached: params.targetLength, tapsThisRound: [] }));
          setPhase('done');
        } else {
          // Move to next round.
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
      // Wrong tap.
      if (currentSt.muscleMemoryUsed && !currentSt.fumbleForgiven) {
        // Muscle Memory forgives one fumble — continue round from scratch.
        setState(s => ({ ...s, fumbleForgiven: true, tapsThisRound: [] }));
        setPhase('watching');
      } else {
        // Chain breaks.
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
    // Photographic: restart watching phase so the player sees the sequence again.
    if (hook.lane === 'tech' && !stateRef.current.photographicUsed) {
      setPhase('watching');
      setReplayVersion(v => v + 1);
    }
  }

  // Determine which cards to highlight vs dim during playback.
  const faceDown: CardId[] =
    phase === 'watching' && highlightIndex !== null
      ? params.cards
          .filter(c => c.id !== params.sequence[highlightIndex])
          .map(c => c.id)
      : [];

  const progressText = `${state.lengthReached}/${params.targetLength}`;

  return (
    <div data-testid="follow-the-circuit">
      <div data-testid="ftc-info">
        <span data-testid="ftc-progress">Progress: {progressText}</span>
        <span> | Round length: {currentRoundLength}</span>
        {phase === 'watching' && <span data-testid="ftc-phase"> — WATCH</span>}
        {phase === 'inputting' && <span data-testid="ftc-phase"> — TAP</span>}
        {state.chainBroke && <span data-testid="ftc-broke"> — CHAIN BROKE</span>}
        {state.fumbleForgiven && <span data-testid="ftc-forgiven"> (fumble forgiven)</span>}
      </div>

      <CardSpread
        cards={params.cards}
        layout="grid"
        faceDown={faceDown}
        {...(phase === 'inputting' && !isDone ? { onTap: handleCardTap } : {})}
      />

      <div data-testid="ftc-taps">
        Taps this round: {state.tapsThisRound.length}/{currentRoundLength}
      </div>

      <div data-testid="boosts">
        <BoostButton<FollowTheCircuitState, FollowTheCircuitParams>
          hook={photographicBoost}
          committed={committed}
          onFire={handleBoost}
        />
        <BoostButton<FollowTheCircuitState, FollowTheCircuitParams>
          hook={muscleMemoryBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
