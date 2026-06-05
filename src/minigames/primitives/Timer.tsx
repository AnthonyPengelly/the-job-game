import { useEffect, useRef, useState } from 'react';

export interface TimerProps {
  seconds: number;
  running: boolean;
  onExpire(): void;
  audible?: boolean;
}

/** Audible countdown timer. Uses Web Audio for tick/expiry beeps (E9 will integrate with the shared engine). */
export function Timer({ seconds, running, onExpire, audible = true }: TimerProps): JSX.Element {
  const [remaining, setRemaining] = useState(seconds);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setRemaining(seconds);
    expiredRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        playBeep(880, 0.3);
        onExpireRef.current();
      }
      return;
    }

    const id = setTimeout(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (audible && next > 0) playBeep(440, 0.05);
        return next;
      });
    }, 1000);
    return () => clearTimeout(id);
  }, [running, remaining, audible]);

  const pct = seconds > 0 ? remaining / seconds : 0;
  const urgent = remaining <= 5 && remaining > 0;

  return (
    <div data-testid="timer" data-remaining={remaining} style={{ fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ color: urgent ? 'red' : undefined }}>
        {formatTime(remaining)}
      </span>
      <div
        data-testid="timer-bar"
        style={{ width: `${Math.max(0, pct * 100)}%`, height: 4, background: urgent ? 'red' : 'green' }}
      />
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function playBeep(frequency: number, duration: number): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => { void ctx.close(); };
  } catch {
    // AudioContext unavailable in test/SSR environments — silent fallback
  }
}
