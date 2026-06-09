// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { CrackTheTumblersComponent } from './component';

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

// ── Pin board visibility ───────────────────────────────────────────────────────

describe('CrackTheTumblersComponent — pin board', () => {
  it('renders the pin board with correct total pin count', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('pin-board')).toBeInTheDocument();
    // All pins present: N played + N-played empty/next
    const total = params.cards.length;
    expect(screen.getByTestId('pin-next')).toBeInTheDocument(); // first pin: next slot
    // Remaining slots are empty
    const emptyPins = screen.queryAllByTestId(/^pin-empty-/);
    expect(emptyPins.length + 1).toBe(total); // next + empty = total
  });

  it('next slot shows "?" when nothing played', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('pin-next').textContent).toBe('?');
  });

  it('progress meter label shows pins set / total', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('card-count').textContent).toContain(`0 / ${params.cards.length}`);
  });

  it('played pin appears lit after a card is tapped in correct order', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    // Tap the first card in correct order
    const firstCorrectId = params.correctOrder[0]!;
    fireEvent.click(screen.getByTestId(`card-${firstCorrectId}`));
    expect(screen.getByTestId('pin-played-0')).toBeInTheDocument();
  });
});

// ── Clash state ────────────────────────────────────────────────────────────────

describe('CrackTheTumblersComponent — clash / alarm', () => {
  it('alarm-tripped badge shows when a wrong-order card is played', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    // Play the highest-valued card first (out of order)
    if (params.cards.length > 1) {
      const highestId = params.correctOrder[params.correctOrder.length - 1]!;
      fireEvent.click(screen.getByTestId(`card-${highestId}`));
      // Now play a lower-valued card to trigger clash
      const lowestId = params.correctOrder[0]!;
      if (lowestId !== highestId) {
        fireEvent.click(screen.getByTestId(`card-${lowestId}`));
        expect(screen.getByTestId('alarm-tripped')).toBeInTheDocument();
      }
    }
  });
});

// ── Boost slot (no layout shift) ──────────────────────────────────────────────

describe('CrackTheTumblersComponent — boost slot', () => {
  it('boost slot is always rendered (no layout shift when boost fires)', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    // mg-boost-slot must always be present (reserve space)
    const slots = document.querySelectorAll('.mg-boost-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });

  it('Reset Pin boost renders for Tech power-up holder', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersComponent
        params={params}
        dial={dial}
        committed={makeCommittedWithTech()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('boost-tech')).toBeInTheDocument();
  });

  it('Reset Pin boost fires once then disables', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersComponent
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
});

// ── Call Outcome ───────────────────────────────────────────────────────────────

describe('CrackTheTumblersComponent — onResolve', () => {
  it('calls onResolve with botched when nothing played', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <CrackTheTumblersComponent
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
