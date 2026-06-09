// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { makeGenerate } from './generate';
import { CategoriesComponent } from './component';

afterEach(cleanup);

const dial: Difficulty = { level: 0 };

const TEST_ITEMS = ['Things in a kitchen', 'Types of cheese', 'European cities'];

function makeParams(seed = 1) {
  return makeGenerate(TEST_ITEMS)(mulberry32(seed), dial);
}

function makeCommitted(withCharm = false) {
  return [
    {
      id: 'p1' as import('@/engine').PlayerId,
      name: 'Millie',
      stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
      powerUps: withCharm ? { charm: true as const } : {},
    },
  ];
}

// ── Hero category ─────────────────────────────────────────────────────────────

describe('CategoriesComponent — hero category', () => {
  it('renders the active category as the hero word', () => {
    const params = makeParams(1);
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('categories-category').textContent).toBe(params.category);
  });

  it('shows skip category after Skip boost fires', () => {
    const params = makeParams(1);
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('boost-charm'));
    expect(screen.getByTestId('categories-category').textContent).toBe(params.skipCategory);
  });
});

// ── Tally controls ────────────────────────────────────────────────────────────

describe('CategoriesComponent — tally controls', () => {
  it('tally starts at 0', () => {
    const params = makeParams(1);
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('tally-count').textContent).toBe('0');
  });

  it('+1 button increments the tally', () => {
    const params = makeParams(1);
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('tally-increment'));
    expect(screen.getByTestId('tally-count').textContent).toBe('1');
  });

  it('undo decrements the tally', () => {
    const params = makeParams(1);
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('tally-increment'));
    fireEvent.click(screen.getByTestId('tally-undo'));
    expect(screen.getByTestId('tally-count').textContent).toBe('0');
  });

  it('undo is disabled at tally 0', () => {
    const params = makeParams(1);
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('tally-undo')).toBeDisabled();
  });
});

// ── Hint text ─────────────────────────────────────────────────────────────────

describe('CategoriesComponent — hint text', () => {
  it('shows remaining count hint before target is met', () => {
    const params = makeParams(1);
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('categories-hint').textContent).toContain('before the buzzer');
  });

  it('shows target reached text after meeting the target', () => {
    const params = { ...makeParams(1), targetCount: 1 };
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('tally-increment'));
    expect(screen.getByTestId('categories-hint').textContent).toContain('Target reached');
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('CategoriesComponent — onResolve', () => {
  it('calls onResolve with judge suggestion', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('calls onResolve with clean when target is met', () => {
    const params = { ...makeParams(1), targetCount: 1 };
    const spy = vi.fn();
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    fireEvent.click(screen.getByTestId('tally-increment'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('clean');
  });
});

// ── Boost slot (no layout shift) ──────────────────────────────────────────────

describe('CategoriesComponent — boost slot', () => {
  it('mg-boost-slot always rendered regardless of boost eligibility', () => {
    const params = makeParams(1);
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted(false)}
        onResolve={() => {}}
      />,
    );
    const slots = document.querySelectorAll('.mg-boost-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Progress bar ──────────────────────────────────────────────────────────────

describe('CategoriesComponent — progress bar', () => {
  it('progress bar rendered', () => {
    const params = makeParams(1);
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('categories-progress')).toBeInTheDocument();
  });

  it('progress fill grows as tally increments', () => {
    const params = { ...makeParams(1), targetCount: 4 };
    render(
      <CategoriesComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const fill = screen.getByTestId('categories-progress-fill');
    expect(fill.style.width).toBe('0%');
    fireEvent.click(screen.getByTestId('tally-increment'));
    expect(fill.style.width).toBe('25%');
  });
});
