// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

afterEach(cleanup);
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { TheOnceOverComponent } from './component';

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted(powerUps: Record<string, boolean> = {}) {
  return [{ id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps }];
}

function renderGame(onResolve: (o: string) => void = () => {}, committed = makeCommitted()) {
  const params = makeParams(1);
  render(
    <TheOnceOverComponent
      params={params}
      dial={dial}
      committed={committed}
      onResolve={onResolve as never}
    />,
  );
  return params;
}

function toIdentify() {
  fireEvent.click(screen.getByTestId('oo-start-study'));
  // Expire study timer by firing onExpire via the change-phase shortcut:
  // the Timer is real; instead drive phases through the GM buttons where possible.
}

// ── Setup phase ───────────────────────────────────────────────────────────────

describe('TheOnceOverComponent — setup', () => {
  it('starts in setup with deal instructions', () => {
    const params = renderGame();
    expect(screen.getByTestId('oo-phase').textContent).toContain('Setup');
    expect(screen.getByTestId('oo-setup').textContent).toContain(`${params.cardCount} cards face-up`);
  });

  it('no Call Outcome before the identify phase', () => {
    renderGame();
    expect(screen.queryByTestId('btn-call-outcome')).not.toBeInTheDocument();
  });

  it('change instructions are not visible during setup or study', () => {
    renderGame();
    expect(screen.queryByTestId('oo-change-list')).not.toBeInTheDocument();
    toIdentify();
    expect(screen.queryByTestId('oo-change-list')).not.toBeInTheDocument();
  });
});

// ── Study → change → identify flow (timer driven) ────────────────────────────

describe('TheOnceOverComponent — phase flow', () => {
  it('study phase shows the timer', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('oo-start-study'));
    expect(screen.getByTestId('oo-phase').textContent).toContain('Study');
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });

  it('after study expiry the positional instructions appear, then reveal → identify', () => {
    vi.useFakeTimers();
    const params = renderGame();
    fireEvent.click(screen.getByTestId('oo-start-study'));
    // run the study clock down
    for (let i = 0; i <= params.studySeconds; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    vi.useRealTimers();
    expect(screen.getByTestId('oo-change-instructions')).toBeInTheDocument();
    const list = screen.getByTestId('oo-change-list');
    expect(list.textContent).toMatch(/position/i);
    fireEvent.click(screen.getByTestId('oo-reveal'));
    expect(screen.getByTestId('identify-phase')).toBeInTheDocument();
    expect(screen.getByTestId('oo-record-controls')).toBeInTheDocument();
  });
});

// ── Recording and outcome ─────────────────────────────────────────────────────

function driveToIdentify(params: ReturnType<typeof makeParams>) {
  vi.useFakeTimers();
  fireEvent.click(screen.getByTestId('oo-start-study'));
  for (let i = 0; i <= params.studySeconds; i++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
  vi.useRealTimers();
  fireEvent.click(screen.getByTestId('oo-reveal'));
}

describe('TheOnceOverComponent — recording and outcome', () => {
  it('all changes spotted → onResolve clean', () => {
    const spy = vi.fn();
    const params = renderGame(spy);
    driveToIdentify(params);
    for (let i = 0; i < params.changeCount; i++) {
      fireEvent.click(screen.getByTestId('oo-hit'));
    }
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('clean');
  });

  it('nothing spotted → onResolve botched', () => {
    const spy = vi.fn();
    const params = renderGame(spy);
    driveToIdentify(params);
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });

  it('Spotted disables once every change is recorded', () => {
    const params = renderGame();
    driveToIdentify(params);
    for (let i = 0; i < params.changeCount; i++) {
      fireEvent.click(screen.getByTestId('oo-hit'));
    }
    expect(screen.getByTestId('oo-hit')).toBeDisabled();
  });
});

// ── Boost ────────────────────────────────────────────────────────────────────

describe('TheOnceOverComponent — Hunch boost', () => {
  it('renders for a stealth power-up holder and fires once', () => {
    renderGame(() => {}, makeCommitted({ stealth: true }));
    const btn = screen.getByTestId('boost-stealth');
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });
});
