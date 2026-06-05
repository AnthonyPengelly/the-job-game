import { useState, useRef, useEffect } from 'react';
import type { MiniGameProps, BoostHook } from '@/minigames/contract';
import { useMetronome } from '@/minigames/primitives/Metronome';
import { BoostButton } from '@/minigames/primitives/BoostButton';
import { OutcomeJudge } from '@/minigames/primitives/OutcomeJudge';
import type { Beat16Params } from './generate';
import { judge, inTheBonesBoost } from './judge';
import type { Beat16State } from './judge';

function initState(): Beat16State {
  return { tapTimestampMs: null, measuredDeltaMs: null, boostUsed: false };
}

export function Beat16Component({
  params,
  committed,
  onResolve,
}: MiniGameProps<Beat16Params>): JSX.Element {
  const [state, setState] = useState<Beat16State>(initState);

  // Re-run the metronome from scratch when the boost adds 2 extra audible beats.
  const effectiveAudibleBeats = params.audibleBeats + (state.boostUsed ? 2 : 0);
  const metronome = useMetronome({ bpm: params.bpm, audibleBeats: effectiveAudibleBeats });

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
  const suggested = judge(state, params);

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
    setState(s => ({
      ...s,
      tapTimestampMs: now,
      measuredDeltaMs: delta,
    }));
  }

  function handleBoost(hook: BoostHook<Beat16State, Beat16Params>) {
    setState(s => hook.apply(s, params));
  }

  return (
    <div data-testid="beat-16">
      <div data-testid="beat16-info">
        <span data-testid="target-beat">Count to: {params.targetBeat}</span>
        <span> | BPM: {params.bpm}</span>
        <span data-testid="audible-beats"> | Audible: {effectiveAudibleBeats}</span>
      </div>

      <button
        data-testid="btn-tap"
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

      <div data-testid="boosts">
        <BoostButton<Beat16State, Beat16Params>
          hook={inTheBonesBoost}
          committed={committed}
          onFire={handleBoost}
        />
      </div>

      <OutcomeJudge key={suggested} suggested={suggested} onConfirm={onResolve} />
    </div>
  );
}
