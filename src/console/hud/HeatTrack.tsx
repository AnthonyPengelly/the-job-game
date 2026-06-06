import { useEffect, useRef, useState } from 'react';
import './HeatTrack.css';

interface HeatTrackProps {
  heat: number;
  hMax: number;
}

/** Number of unfilled slots at the high end of the track that show amber warning. */
const WARN_BAND = 3;

export function HeatTrack({ heat, hMax }: HeatTrackProps) {
  const prevHeatRef = useRef(heat);
  // Index of the first newly-filled slot when heat rises; null means no animation in progress.
  const [fillingFrom, setFillingFrom] = useState<number | null>(null);

  useEffect(() => {
    const prev = prevHeatRef.current;
    prevHeatRef.current = heat;
    if (heat > prev) {
      setFillingFrom(prev);
      const id = setTimeout(() => setFillingFrom(null), 280); // dur-slow = 280ms
      return () => clearTimeout(id);
    }
  }, [heat]);

  const warnStart = hMax - WARN_BAND;

  return (
    <div
      data-testid="heat-track"
      aria-label={`Heat: ${heat} of ${hMax}`}
      className="track"
    >
      {Array.from({ length: hMax }, (_, i) => {
        const filled = i < heat;
        const isLive = filled && i === heat - 1;
        const isNext = i === heat;
        const isWarn = !filled && !isNext && i >= warnStart;
        const isNewlyFilled =
          filled && fillingFrom !== null && i >= fillingFrom;

        const classes = ['slot'];
        if (filled) classes.push('on');
        if (isLive)  classes.push('live');
        if (isNext)  classes.push('next');
        if (isWarn)  classes.push('warn');
        if (isNewlyFilled) classes.push('filling');

        return (
          <div
            key={i}
            className={classes.join(' ')}
            data-testid={filled ? 'heat-slot-filled' : 'heat-slot-empty'}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
