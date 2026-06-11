// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { CrackTheTumblersSoloComponent } from './component';

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted() {
  return [{ id: 'p1' as import('@/engine').PlayerId, name: 'Alice', stats: { tech: 3, physical: 3, charm: 3, stealth: 3 }, powerUps: {} }];
}

function renderGame(onResolve: (o: string) => void = () => {}) {
  const params = makeParams(1);
  render(
    <CrackTheTumblersSoloComponent
      params={params}
      dial={dial}
      committed={makeCommitted()}
      onResolve={onResolve as never}
    />,
  );
  return params;
}

// ── Setup phase ───────────────────────────────────────────────────────────────

describe('CrackTheTumblersSoloComponent — setup phase', () => {
  it('starts in setup with deal instructions naming the player', () => {
    const params = renderGame();
    expect(screen.getByTestId('ctt-solo-phase').textContent).toBe('Setup');
    const setup = screen.getByTestId('solo-setup');
    expect(setup.textContent).toContain('Alice');
    expect(setup.textContent).toContain(`${params.cardCount} cards face-up`);
  });

  it('no Call Outcome until the study clock has started', () => {
    renderGame();
    expect(screen.queryByTestId('btn-call-outcome')).not.toBeInTheDocument();
  });
});

// ── Study → recall flow ───────────────────────────────────────────────────────

describe('CrackTheTumblersSoloComponent — study and recall', () => {
  it('starting the study clock enters the study phase', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('solo-start-study'));
    expect(screen.getByTestId('ctt-solo-phase').textContent).toBe('Study');
    expect(screen.getByTestId('study-phase')).toBeInTheDocument();
  });

  it('record controls are hidden during study', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('solo-start-study'));
    expect(screen.queryByTestId('solo-record-controls')).not.toBeInTheDocument();
  });
});

// ── Recording (driven directly into recall via state) ────────────────────────

describe('CrackTheTumblersSoloComponent — outcome', () => {
  it('call outcome yields botched when nothing flipped', () => {
    const spy = vi.fn();
    renderGame(spy);
    fireEvent.click(screen.getByTestId('solo-start-study'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });
});

// ── Boost slot ────────────────────────────────────────────────────────────────

describe('CrackTheTumblersSoloComponent — boost slot', () => {
  it('mg-boost-slot always rendered (no layout shift)', () => {
    renderGame();
    const slots = document.querySelectorAll('.mg-boost-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });
});
