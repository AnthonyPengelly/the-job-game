// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { SteadyHandsComponent } from './component';

afterEach(cleanup);

function startClockIfGated() {
  const gate = screen.queryByTestId('mg-start-clock');
  if (gate) fireEvent.click(gate);
}


beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted(withPhysOrStealth = false) {
  return [
    {
      id: 'p1' as import('@/engine').PlayerId,
      name: 'George',
      stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
      powerUps: withPhysOrStealth ? { physical: true as const } : {},
    },
  ];
}

// ── Tower visual ──────────────────────────────────────────────────────────────

describe('SteadyHandsComponent — tower visual', () => {
  it('renders the tower', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    expect(screen.getByTestId('sh-tower')).toBeInTheDocument();
  });

  it('tower starts with all target bricks (no solid bricks at height 0)', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    const tower = screen.getByTestId('sh-tower');
    const targetBricks = tower.querySelectorAll('.sh-brick--target');
    expect(targetBricks.length).toBe(params.targetHeight);
  });

  it('+1 height button converts a target brick to a solid brick', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    fireEvent.click(screen.getByTestId('sh-height-up'));
    const tower = screen.getByTestId('sh-tower');
    const solidBricks = tower.querySelectorAll('.sh-brick:not(.sh-brick--target)');
    expect(solidBricks.length).toBe(1);
    const targetBricks = tower.querySelectorAll('.sh-brick--target');
    expect(targetBricks.length).toBe(params.targetHeight - 1);
  });
});

// ── Height counter ─────────────────────────────────────────────────────────────

describe('SteadyHandsComponent — height counter', () => {
  it('hero height starts at 0', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    expect(screen.getByTestId('sh-height-hero').textContent).toContain('0');
  });

  it('+1 button increments the hero height', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    fireEvent.click(screen.getByTestId('sh-height-up'));
    expect(screen.getByTestId('sh-height-hero').textContent).toContain('1');
  });

  it('undo decrements the height', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    fireEvent.click(screen.getByTestId('sh-height-up'));
    fireEvent.click(screen.getByTestId('sh-height-down'));
    expect(screen.getByTestId('sh-height-hero').textContent).toContain('0');
  });

  it('+1 disabled at target height', () => {
    const params = { ...makeParams(1), targetHeight: 1 };
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    fireEvent.click(screen.getByTestId('sh-height-up'));
    expect(screen.getByTestId('sh-height-up')).toBeDisabled();
  });

  it('undo disabled at height 0', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    expect(screen.getByTestId('sh-height-down')).toBeDisabled();
  });
});

// ── Progress bar ──────────────────────────────────────────────────────────────

describe('SteadyHandsComponent — progress bar', () => {
  it('renders the progress bar', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    expect(screen.getByTestId('sh-progress')).toBeInTheDocument();
  });

  it('progress fill grows as height increases', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    const fill = screen.getByTestId('sh-progress-fill');
    expect(fill.style.width).toBe('0%');
    fireEvent.click(screen.getByTestId('sh-height-up'));
    const pct = parseFloat(fill.style.width);
    expect(pct).toBeGreaterThan(0);
  });
});

// ── Extra Hands burst ─────────────────────────────────────────────────────────

describe('SteadyHandsComponent — Extra Hands burst', () => {
  it('burst panel not visible before boost fires', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    expect(screen.queryByTestId('sh-extra-hands')).toBeNull();
  });

  it('burst panel appears when Extra Hands fires', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    fireEvent.click(screen.getByTestId('boost-physical'));
    expect(screen.getByTestId('sh-extra-hands')).toBeInTheDocument();
  });

  it('burst panel disappears after 10s', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    fireEvent.click(screen.getByTestId('boost-physical'));
    // Advance 11 seconds one tick at a time so React flushes state each second
    for (let i = 0; i <= 10; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    expect(screen.queryByTestId('sh-extra-hands')).toBeNull();
  });
});

// ── Boost slot (no layout shift) ──────────────────────────────────────────────

describe('SteadyHandsComponent — boost slot', () => {
  it('mg-boost-slot always rendered regardless of boost eligibility', () => {
    const params = makeParams(1);
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted(false)}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    const slots = document.querySelectorAll('.mg-boost-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('SteadyHandsComponent — onResolve', () => {
  it('calls onResolve when Call Outcome clicked', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    startClockIfGated();
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('calls onResolve with complication by default (GM-judged)', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    startClockIfGated();
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('complication');
  });

  it('calls onResolve with botched when timer expires', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <SteadyHandsComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    startClockIfGated();
    // Advance one tick at a time so React flushes state after each second
    for (let i = 0; i <= params.timerSeconds; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });
});
