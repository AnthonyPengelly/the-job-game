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

// ── Study phase ────────────────────────────────────────────────────────────────

describe('CrackTheTumblersSoloComponent — study phase', () => {
  it('starts in study phase showing study pins', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersSoloComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('ctt-solo-phase').textContent).toContain('Study');
    expect(screen.getByTestId('study-phase')).toBeInTheDocument();
  });

  it('shows a pin for each study card', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersSoloComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const pins = screen.queryAllByTestId(/^study-pin-/);
    expect(pins.length).toBe(params.studyCards.length);
  });

  it('Start Recall button transitions to recall phase', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersSoloComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('start-recall'));
    expect(screen.getByTestId('recall-phase')).toBeInTheDocument();
    expect(screen.getByTestId('ctt-solo-phase').textContent).toContain('Recall');
  });
});

// ── Recall phase ───────────────────────────────────────────────────────────────

describe('CrackTheTumblersSoloComponent — recall phase', () => {
  it('recall shows next slot as dashed ?', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersSoloComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('start-recall'));
    expect(screen.getByTestId('recall-next')).toBeInTheDocument();
    expect(screen.getByTestId('recall-next').textContent).toBe('?');
  });

  it('progress meter updates after correct recall tap', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersSoloComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('start-recall'));
    const firstCorrectId = params.correctOrder[0]!;
    fireEvent.click(screen.getByTestId(`card-${firstCorrectId}`));
    expect(screen.getByTestId('recalled-pin-0')).toBeInTheDocument();
  });

  it('call outcome yields botched when nothing recalled', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <CrackTheTumblersSoloComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    fireEvent.click(screen.getByTestId('start-recall'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });
});

// ── Boost slot ─────────────────────────────────────────────────────────────────

describe('CrackTheTumblersSoloComponent — boost slot', () => {
  it('mg-boost-slot always rendered (no layout shift)', () => {
    const params = makeParams(1);
    render(
      <CrackTheTumblersSoloComponent
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
