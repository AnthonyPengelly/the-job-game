// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { Beat16Component } from './component';

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted() {
  return [{ id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps: {} }];
}

function makeCommittedWithPhysical() {
  return [{ id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps: { physical: true as const } }];
}

// ── Beat dots ─────────────────────────────────────────────────────────────────

describe('Beat16Component — beat dots', () => {
  it('renders a beat dot for each beat up to targetBeat', () => {
    const params = makeParams(1);
    render(
      <Beat16Component
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('beat-dots')).toBeInTheDocument();
    const dots = screen.queryAllByTestId(/^beat-dot-/);
    expect(dots.length).toBe(params.targetBeat);
  });

  it('target beat dot has the target class', () => {
    const params = makeParams(1);
    render(
      <Beat16Component
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const targetDot = screen.getByTestId(`beat-dot-${params.targetBeat}`);
    expect(targetDot.classList.contains('b16-dot--target')).toBe(true);
  });
});

// ── TAP button ────────────────────────────────────────────────────────────────

describe('Beat16Component — TAP control', () => {
  it('TAP button is rendered and enabled initially', () => {
    const params = makeParams(1);
    render(
      <Beat16Component
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('btn-tap')).toBeInTheDocument();
    expect(screen.getByTestId('btn-tap')).not.toBeDisabled();
  });

  it('after TAP, feedback area appears', () => {
    const params = makeParams(1);
    render(
      <Beat16Component
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-tap'));
    expect(screen.getByTestId('tap-result')).toBeInTheDocument();
  });

  it('TAP button is gone after tapping (one-shot)', () => {
    const params = makeParams(1);
    render(
      <Beat16Component
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-tap'));
    expect(screen.queryByTestId('btn-tap')).not.toBeInTheDocument();
  });
});

// ── Audible beats counter ─────────────────────────────────────────────────────

describe('Beat16Component — audible beats display', () => {
  it('shows audible beats count', () => {
    const params = makeParams(1);
    render(
      <Beat16Component
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const el = screen.getByTestId('audible-beats');
    expect(el.textContent).toContain(String(params.audibleBeats));
  });

  it('audible beats increases by 2 after In the Bones boost', () => {
    const params = makeParams(1);
    render(
      <Beat16Component
        params={params}
        dial={dial}
        committed={makeCommittedWithPhysical()}
        onResolve={() => {}}
      />,
    );
    const before = parseInt(
      screen.getByTestId('audible-beats').textContent?.replace(/\D/g, '') ?? '0',
      10,
    );
    fireEvent.click(screen.getByTestId('boost-physical'));
    const after = parseInt(
      screen.getByTestId('audible-beats').textContent?.replace(/\D/g, '') ?? '0',
      10,
    );
    expect(after).toBe(before + 2);
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('Beat16Component — onResolve', () => {
  it('calls onResolve with botched when no tap', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <Beat16Component
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

// ── Boost slot (no layout shift) ──────────────────────────────────────────────

describe('Beat16Component — boost slot', () => {
  it('mg-boost-slot always rendered', () => {
    const params = makeParams(1);
    render(
      <Beat16Component
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
