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
  return [
    { id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps: {} },
    { id: 'p2' as import('@/engine').PlayerId, name: 'Bram', stats: { tech: 0, physical: 2, charm: 0, stealth: 0 }, powerUps: {} },
  ];
}

function makeCommittedWithTech() {
  return [
    { id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps: { tech: true as const } },
    { id: 'p2' as import('@/engine').PlayerId, name: 'Bram', stats: { tech: 0, physical: 2, charm: 0, stealth: 0 }, powerUps: {} },
  ];
}

function renderGame(committed = makeCommitted(), onResolve: (o: string) => void = () => {}) {
  const params = makeParams(1);
  render(
    <CrackTheTumblersComponent
      params={params}
      dial={dial}
      committed={committed}
      onResolve={onResolve as never}
    />,
  );
  return params;
}

function beginPlay() {
  fireEvent.click(screen.getByTestId('ctb-dealt'));
}

// ── Setup panel ───────────────────────────────────────────────────────────────

describe('CrackTheTumblersComponent — setup panel', () => {
  it('shows deal instructions with every committed player named', () => {
    renderGame();
    const setup = screen.getByTestId('ctb-setup');
    expect(setup.textContent).toContain('Alice');
    expect(setup.textContent).toContain('Bram');
    expect(setup.textContent).toContain('Shuffle the pack');
  });

  it('states the cards-per-player count from params', () => {
    const params = renderGame();
    expect(screen.getByTestId('ctb-setup').textContent).toContain(
      `${params.cardsPerPlayer} card`,
    );
  });

  it('total in the progress label is committed × cardsPerPlayer', () => {
    const params = renderGame();
    expect(screen.getByTestId('card-count').textContent).toContain(
      `0 / ${params.cardsPerPlayer * 2}`,
    );
  });

  it('record controls appear only after the GM confirms the deal', () => {
    renderGame();
    expect(screen.queryByTestId('ctb-record-controls')).not.toBeInTheDocument();
    beginPlay();
    expect(screen.getByTestId('ctb-record-controls')).toBeInTheDocument();
  });
});

// ── Recording plays ───────────────────────────────────────────────────────────

describe('CrackTheTumblersComponent — recording', () => {
  it('✓ In order increments the pins-set count', () => {
    const params = renderGame();
    beginPlay();
    fireEvent.click(screen.getByTestId('ctb-in-order'));
    expect(screen.getByTestId('card-count').textContent).toContain(
      `1 / ${params.cardsPerPlayer * 2}`,
    );
  });

  it('✗ Clash trips the alarm badge', () => {
    renderGame();
    beginPlay();
    fireEvent.click(screen.getByTestId('ctb-clash'));
    expect(screen.getByTestId('alarm-tripped')).toBeInTheDocument();
  });

  it('record controls disappear once the alarm trips', () => {
    renderGame();
    beginPlay();
    fireEvent.click(screen.getByTestId('ctb-clash'));
    expect(screen.queryByTestId('ctb-record-controls')).not.toBeInTheDocument();
  });
});

// ── Boost slot ────────────────────────────────────────────────────────────────

describe('CrackTheTumblersComponent — boost slot', () => {
  it('boost slot is always rendered (no layout shift when boost fires)', () => {
    renderGame();
    const slots = document.querySelectorAll('.mg-boost-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });

  it('Reset Pin boost renders for Tech power-up holder', () => {
    renderGame(makeCommittedWithTech());
    expect(screen.getByTestId('boost-tech')).toBeInTheDocument();
  });

  it('Reset Pin clears the alarm and re-enables recording', () => {
    renderGame(makeCommittedWithTech());
    beginPlay();
    fireEvent.click(screen.getByTestId('ctb-clash'));
    fireEvent.click(screen.getByTestId('boost-tech'));
    expect(screen.queryByTestId('alarm-tripped')).not.toBeInTheDocument();
    expect(screen.getByTestId('ctb-record-controls')).toBeInTheDocument();
  });

  it('Reset Pin boost fires once then disables', () => {
    renderGame(makeCommittedWithTech());
    const btn = screen.getByTestId('boost-tech');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });
});

// ── Call Outcome ──────────────────────────────────────────────────────────────

describe('CrackTheTumblersComponent — onResolve', () => {
  it('calls onResolve with botched when nothing recorded', () => {
    const spy = vi.fn();
    renderGame(makeCommitted(), spy);
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });

  it('calls onResolve with clean when every card is recorded in order', () => {
    const spy = vi.fn();
    const params = makeParams(1);
    render(
      <CrackTheTumblersComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    beginPlay();
    const total = params.cardsPerPlayer * 2;
    for (let i = 0; i < total; i++) {
      fireEvent.click(screen.getByTestId('ctb-in-order'));
    }
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('clean');
  });
});
