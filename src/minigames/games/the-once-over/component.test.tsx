// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { TheOnceOverComponent } from './component';

afterEach(cleanup);

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

function makeCommitted() {
  return [{ id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps: {} }];
}

function makeCommittedWithStealth() {
  return [{ id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps: { stealth: true as const } }];
}

// ── Study phase ────────────────────────────────────────────────────────────────

describe('TheOnceOverComponent — study phase', () => {
  it('starts in Study phase', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('onceover-phase').textContent).toContain('Study');
  });

  it('shows card spread in study phase', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('onceover-spread')).toBeInTheDocument();
    // All original cards visible
    for (const card of params.originalCards) {
      expect(screen.getByTestId(`onceover-card-${card.id}`)).toBeInTheDocument();
    }
  });

  it('cards are not tappable in study phase', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    for (const card of params.originalCards) {
      expect(screen.getByTestId(`onceover-card-${card.id}`)).toBeDisabled();
    }
  });
});

// ── Identify phase ─────────────────────────────────────────────────────────────

describe('TheOnceOverComponent — identify phase', () => {
  it('transitions to identify phase when timer expires', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    // Advance timer to expire
    for (let i = 0; i <= params.studySeconds; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    expect(screen.getByTestId('onceover-phase').textContent).toContain('Identify');
  });

  it('changed cards have amber edge (data-changed=true) in identify phase', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    for (let i = 0; i <= params.studySeconds; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    // GM-only: changed cards are marked
    for (const changedId of params.changedCardIds) {
      const card = screen.getByTestId(`onceover-card-${changedId}`);
      expect(card.getAttribute('data-changed')).toBe('true');
    }
  });

  it('tapping a card in identify phase flags it', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    for (let i = 0; i <= params.studySeconds; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    const firstCard = params.modifiedCards[0]!;
    const cardEl = screen.getByTestId(`onceover-card-${firstCard.id}`);
    fireEvent.click(cardEl);
    expect(cardEl.getAttribute('data-flagged')).toBe('true');
  });

  it('tapping a flagged card unflags it', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    for (let i = 0; i <= params.studySeconds; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    const firstCard = params.modifiedCards[0]!;
    const cardEl = screen.getByTestId(`onceover-card-${firstCard.id}`);
    fireEvent.click(cardEl); // flag
    expect(cardEl.getAttribute('data-flagged')).toBe('true');
    fireEvent.click(cardEl); // unflag
    expect(cardEl.getAttribute('data-flagged')).toBe('false');
  });

  it('GM hint line visible in identify phase', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    for (let i = 0; i <= params.studySeconds; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    expect(screen.getByTestId('onceover-gm-hint')).toBeInTheDocument();
  });
});

// ── Hunch boost ───────────────────────────────────────────────────────────────

describe('TheOnceOverComponent — Hunch boost', () => {
  it('Hunch boost renders for stealth power-up holder', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommittedWithStealth()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('boost-stealth')).toBeInTheDocument();
  });

  it('hunch-active indicator appears after firing Hunch', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommittedWithStealth()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('boost-stealth'));
    expect(screen.getByTestId('hunch-active')).toBeInTheDocument();
  });

  it('Hunch fires once then disables', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommittedWithStealth()}
        onResolve={() => {}}
      />,
    );
    const btn = screen.getByTestId('boost-stealth');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });
});

// ── Boost slot (no layout shift) ──────────────────────────────────────────────

describe('TheOnceOverComponent — boost slot', () => {
  it('mg-boost-slot always rendered', () => {
    const params = makeParams(1);
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const slots = document.querySelectorAll('.mg-boost-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('TheOnceOverComponent — onResolve', () => {
  it('calls onResolve with botched when no card flagged', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    for (let i = 0; i <= params.studySeconds; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });

  it('calls onResolve with clean when all changed cards flagged correctly', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <TheOnceOverComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    for (let i = 0; i <= params.studySeconds; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    // Flag all changed cards
    for (const id of params.changedCardIds) {
      fireEvent.click(screen.getByTestId(`onceover-card-${id}`));
    }
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('clean');
  });
});
