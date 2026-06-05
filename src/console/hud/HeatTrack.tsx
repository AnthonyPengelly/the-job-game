// Heat track: displays hMax slots, filled up to current heat value.
// Each slot represents one face-down card; heat slots are "flipped" face-up.
// Uses hMax from cfg — never a hardcoded literal.

interface HeatTrackProps {
  heat: number;
  hMax: number;
}

export function HeatTrack({ heat, hMax }: HeatTrackProps) {
  return (
    <div data-testid="heat-track" aria-label={`Heat: ${heat} of ${hMax}`}>
      {Array.from({ length: hMax }, (_, i) => {
        const filled = i < heat;
        return (
          <span
            key={i}
            data-testid={filled ? 'heat-slot-filled' : 'heat-slot-empty'}
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '1rem',
              height: '1.5rem',
              margin: '0 1px',
              background: filled ? '#c0392b' : '#2c3e50',
              borderRadius: '2px',
              border: filled ? '1px solid #e74c3c' : '1px solid #455a6a',
            }}
          />
        );
      })}
    </div>
  );
}
