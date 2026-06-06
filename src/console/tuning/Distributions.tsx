import type { MonteCarloResult } from './montecarlo';

interface DistributionsProps {
  result: MonteCarloResult | null;
  isRunning?: boolean;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function HistogramBars({ histogram }: { histogram: MonteCarloResult['histogram'] }) {
  if (histogram.length === 0) return null;

  const total = histogram.reduce((s, b) => s + b.count, 0);
  const maxCount = Math.max(...histogram.map(b => b.count));

  return (
    <div data-testid="histogram" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {histogram.map(bin => {
        const barWidth = maxCount > 0 ? (bin.count / maxCount) * 100 : 0;
        const freq = total > 0 ? bin.count / total : 0;
        return (
          <div
            key={bin.obstacles}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'var(--ff-mono)', color: 'var(--fg-muted)' }}
          >
            <span style={{ width: '18px', textAlign: 'right', flexShrink: 0 }}>
              {bin.obstacles}
            </span>
            <div
              style={{
                flex: 1,
                height: '8px',
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-xs)',
                overflow: 'hidden',
              }}
            >
              <div
                data-testid="histogram-bar"
                style={{
                  height: '100%',
                  width: `${barWidth}%`,
                  background: 'var(--accent)',
                  borderRadius: 'var(--radius-xs)',
                  transition: 'width var(--dur-base, 160ms) ease',
                }}
              />
            </div>
            <span style={{ width: '34px', textAlign: 'right', flexShrink: 0 }}>
              {pct(freq)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Displays run-length histogram and win-rate readouts from a MonteCarloResult.
 * Purely presentational — accepts a plain result object so it is unit-testable
 * without a Web Worker (the worker is the caller's concern).
 */
export function Distributions({ result, isRunning = false }: DistributionsProps) {
  return (
    <div
      data-testid="distributions"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontFamily: 'var(--ff-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--fg-muted)',
          }}
        >
          Sim distributions
        </span>
        {isRunning && (
          <span
            data-testid="running-indicator"
            style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: 'var(--ff-mono)' }}
          >
            running…
          </span>
        )}
      </div>

      {result === null ? (
        <span
          data-testid="no-result"
          style={{ fontSize: '12px', color: 'var(--fg-faint)', fontFamily: 'var(--ff-mono)' }}
        >
          —
        </span>
      ) : (
        <>
          {/* Win rate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span
              style={{
                fontFamily: 'var(--ff-mono)',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-faint)',
              }}
            >
              Win rate
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  flex: 1,
                  height: '10px',
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-xs)',
                  overflow: 'hidden',
                }}
              >
                <div
                  data-testid="win-rate-bar"
                  style={{
                    height: '100%',
                    width: `${result.winRate * 100}%`,
                    background: result.winRate >= 0.5 ? 'var(--accent)' : 'var(--caution)',
                    borderRadius: 'var(--radius-xs)',
                    transition: 'width var(--dur-base, 160ms) ease',
                  }}
                />
              </div>
              <span
                data-testid="win-rate-label"
                style={{
                  fontFamily: 'var(--ff-mono)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--fg)',
                  minWidth: '36px',
                  textAlign: 'right',
                }}
              >
                {pct(result.winRate)}
              </span>
            </div>
          </div>

          {/* Run-length histogram */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--ff-mono)',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-faint)',
              }}
            >
              Obstacles / run
            </span>
            <HistogramBars histogram={result.histogram} />
          </div>

          {/* Key stats row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              borderTop: '1px solid var(--border-faint)',
              paddingTop: '8px',
            }}
          >
            {([
              { label: 'Median obs.', value: String(result.medianObstacles), testId: 'stat-median-obs' },
              { label: 'Mean loot', value: result.meanLoot.toFixed(1), testId: 'stat-mean-loot' },
              { label: 'Mean score', value: result.meanScore.toFixed(0), testId: 'stat-mean-score' },
            ] as const).map(({ label, value, testId }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span
                  style={{
                    fontFamily: 'var(--ff-mono)',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--fg-faint)',
                  }}
                >
                  {label}
                </span>
                <span
                  data-testid={testId}
                  style={{
                    fontFamily: 'var(--ff-mono)',
                    fontSize: '13px',
                    color: 'var(--fg)',
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
