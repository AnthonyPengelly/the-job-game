// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Distributions } from './Distributions';
import type { MonteCarloResult } from './montecarlo';

afterEach(() => { cleanup(); });

// ── Inline fixture ────────────────────────────────────────────────────────────

const SAMPLE_RESULT: MonteCarloResult = {
  histogram: [
    { obstacles: 3, count: 80 },
    { obstacles: 4, count: 200 },
    { obstacles: 5, count: 150 },
    { obstacles: 6, count: 70 },
  ],
  winRate: 0.72,
  medianObstacles: 4,
  pRoomsOver10: 0.02,
  pObstTight: 0.68,
  meanLoot: 8.4,
  meanScore: 310.5,
};

// ── null result (idle) ────────────────────────────────────────────────────────

describe('Distributions — null result', () => {
  it('renders the placeholder when result is null', () => {
    render(<Distributions result={null} />);
    expect(screen.getByTestId('no-result')).toBeInTheDocument();
    expect(screen.queryByTestId('histogram')).toBeNull();
    expect(screen.queryByTestId('win-rate-bar')).toBeNull();
  });

  it('does not show the running indicator by default', () => {
    render(<Distributions result={null} />);
    expect(screen.queryByTestId('running-indicator')).toBeNull();
  });

  it('shows the running indicator when isRunning=true', () => {
    render(<Distributions result={null} isRunning={true} />);
    expect(screen.getByTestId('running-indicator')).toBeInTheDocument();
  });
});

// ── Result present ────────────────────────────────────────────────────────────

describe('Distributions — with result', () => {
  it('renders histogram bars for every bin', () => {
    render(<Distributions result={SAMPLE_RESULT} />);
    const bars = screen.getAllByTestId('histogram-bar');
    expect(bars).toHaveLength(SAMPLE_RESULT.histogram.length);
  });

  it('renders the win-rate bar and label', () => {
    render(<Distributions result={SAMPLE_RESULT} />);
    expect(screen.getByTestId('win-rate-bar')).toBeInTheDocument();
    expect(screen.getByTestId('win-rate-label')).toHaveTextContent('72%');
  });

  it('shows the median obstacles stat', () => {
    render(<Distributions result={SAMPLE_RESULT} />);
    expect(screen.getByTestId('stat-median-obs')).toHaveTextContent('4');
  });

  it('shows the mean loot stat', () => {
    render(<Distributions result={SAMPLE_RESULT} />);
    expect(screen.getByTestId('stat-mean-loot')).toHaveTextContent('8.4');
  });

  it('shows the mean score stat', () => {
    render(<Distributions result={SAMPLE_RESULT} />);
    expect(screen.getByTestId('stat-mean-score')).toHaveTextContent('311');
  });

  it('does not render the placeholder when result is present', () => {
    render(<Distributions result={SAMPLE_RESULT} />);
    expect(screen.queryByTestId('no-result')).toBeNull();
  });

  it('shows the running indicator alongside results when isRunning=true', () => {
    render(<Distributions result={SAMPLE_RESULT} isRunning={true} />);
    expect(screen.getByTestId('running-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('win-rate-bar')).toBeInTheDocument();
  });
});

// ── Win-rate bar width ────────────────────────────────────────────────────────

describe('Distributions — win-rate bar width', () => {
  it('sets the bar width proportional to win rate', () => {
    render(<Distributions result={SAMPLE_RESULT} />);
    const bar = screen.getByTestId('win-rate-bar');
    expect((bar as HTMLElement).style.width).toBe('72%');
  });

  it('uses caution colour when win rate is below 50%', () => {
    const lowWinResult: MonteCarloResult = { ...SAMPLE_RESULT, winRate: 0.35 };
    render(<Distributions result={lowWinResult} />);
    const bar = screen.getByTestId('win-rate-bar');
    expect((bar as HTMLElement).style.background).toContain('caution');
  });

  it('uses accent colour when win rate is 50% or above', () => {
    render(<Distributions result={SAMPLE_RESULT} />);
    const bar = screen.getByTestId('win-rate-bar');
    expect((bar as HTMLElement).style.background).toContain('accent');
  });
});

// ── Histogram — bar widths are relative to the tallest bin ───────────────────

describe('Distributions — histogram bar widths', () => {
  it('the tallest bin has 100% bar width', () => {
    render(<Distributions result={SAMPLE_RESULT} />);
    // bin with obstacles=4 has count=200 — the max
    const histogramSection = screen.getByTestId('histogram');
    const bars = histogramSection.querySelectorAll('[data-testid="histogram-bar"]');
    // The bar at index 1 (obstacles=4, count=200) should be 100%
    const tallestBar = bars[1] as HTMLElement;
    expect(tallestBar.style.width).toBe('100%');
  });
});
