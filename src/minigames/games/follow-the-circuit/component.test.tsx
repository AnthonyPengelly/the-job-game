// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { FollowTheCircuitComponent } from './component';

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted() {
  return [{ id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps: {} }];
}

function makeCommittedWithTech() {
  return [{ id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps: { tech: true as const } }];
}

// ── Simon grid ────────────────────────────────────────────────────────────────

describe('FollowTheCircuitComponent — Simon grid', () => {
  it('renders the 2×2 grid with 4 cells', () => {
    const params = makeParams(1);
    render(
      <FollowTheCircuitComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('ftc-grid')).toBeInTheDocument();
    // 4 cells, one per card (A, B, C, D)
    for (const card of params.cards) {
      expect(screen.getByTestId(`ftc-cell-${card.id}`)).toBeInTheDocument();
    }
  });

  it('all cells are disabled in watch phase (not interactive)', () => {
    const params = makeParams(1);
    render(
      <FollowTheCircuitComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    // In watch phase, cells are disabled (not interactive)
    for (const card of params.cards) {
      expect(screen.getByTestId(`ftc-cell-${card.id}`)).toBeDisabled();
    }
  });
});

// ── Progress ──────────────────────────────────────────────────────────────────

describe('FollowTheCircuitComponent — progress', () => {
  it('shows progress tracking in status zone', () => {
    const params = makeParams(1);
    render(
      <FollowTheCircuitComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('ftc-progress')).toBeInTheDocument();
  });

  it('starts with 0 / targetLength progress', () => {
    const params = makeParams(1);
    render(
      <FollowTheCircuitComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const progress = screen.getByTestId('ftc-progress').textContent ?? '';
    expect(progress).toContain('0');
    expect(progress).toContain(String(params.targetLength));
  });
});

// ── Boost ─────────────────────────────────────────────────────────────────────

describe('FollowTheCircuitComponent — Photographic boost', () => {
  it('Photographic boost renders for tech power-up holder', () => {
    const params = makeParams(1);
    render(
      <FollowTheCircuitComponent
        params={params}
        dial={dial}
        committed={makeCommittedWithTech()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('boost-tech')).toBeInTheDocument();
  });

  it('boost fires once then disables', () => {
    const params = makeParams(1);
    render(
      <FollowTheCircuitComponent
        params={params}
        dial={dial}
        committed={makeCommittedWithTech()}
        onResolve={() => {}}
      />,
    );
    const btn = screen.getByTestId('boost-tech');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it('boost slot always rendered (no layout shift)', () => {
    const params = makeParams(1);
    render(
      <FollowTheCircuitComponent
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

describe('FollowTheCircuitComponent — onResolve', () => {
  it('calls onResolve with botched when chain never started', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <FollowTheCircuitComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });
});
