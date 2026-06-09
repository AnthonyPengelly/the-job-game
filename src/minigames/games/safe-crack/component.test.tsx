// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { SafeCrackComponent } from './component';

afterEach(cleanup);

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted(withTechOrStealth = false) {
  return [
    {
      id: 'p1' as import('@/engine').PlayerId,
      name: 'Lucy',
      stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
      powerUps: withTechOrStealth ? { tech: true as const } : {},
    },
  ];
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe('SafeCrackComponent — initial state', () => {
  it('renders the safe-crack container', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('safe-crack')).toBeInTheDocument();
  });

  it('shows the code length and guess budget in status zone', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('code-length').textContent).toContain(`${params.code.length}-digit`);
    expect(screen.getByTestId('code-length').textContent).toContain(`${params.guessBudget} tries`);
  });

  it('shows guess input area initially', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('guess-input')).toBeInTheDocument();
  });

  it('guess history starts empty', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.queryByTestId('guess-row-0')).toBeNull();
  });
});

// ── Guess submission ──────────────────────────────────────────────────────────

describe('SafeCrackComponent — guess submission', () => {
  it('submitting a guess adds a row to the history', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const input = screen.getByTestId('guess-input');
    const wrongGuess = params.code.map(() => 0).join('');
    fireEvent.change(input, { target: { value: wrongGuess } });
    fireEvent.click(screen.getByTestId('guess-submit'));
    expect(screen.getByTestId('guess-row-0')).toBeInTheDocument();
  });

  it('submitted guess digits appear in the row', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const input = screen.getByTestId('guess-input');
    const wrongGuess = params.code.map(() => 0).join('');
    fireEvent.change(input, { target: { value: wrongGuess } });
    fireEvent.click(screen.getByTestId('guess-submit'));
    const digits = screen.getByTestId('guess-digits-0').textContent ?? '';
    expect(digits).toContain('0');
  });

  it('last guess row gets current highlight class', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const input = screen.getByTestId('guess-input');
    // Submit two guesses
    const wrongGuess = params.code.map(() => 0).join('');
    fireEvent.change(input, { target: { value: wrongGuess } });
    fireEvent.click(screen.getByTestId('guess-submit'));
    fireEvent.change(input, { target: { value: wrongGuess } });
    fireEvent.click(screen.getByTestId('guess-submit'));
    expect(screen.getByTestId('guess-row-1').className).toContain('sc-guess-row--current');
    expect(screen.getByTestId('guess-row-0').className).not.toContain('sc-guess-row--current');
  });

  it('peg legend appears after first guess', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.queryByTestId('peg-legend')).toBeNull();
    const input = screen.getByTestId('guess-input');
    const wrongGuess = params.code.map(() => 0).join('');
    fireEvent.change(input, { target: { value: wrongGuess } });
    fireEvent.click(screen.getByTestId('guess-submit'));
    expect(screen.getByTestId('peg-legend')).toBeInTheDocument();
  });

  it('guess input clears after submission', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const input = screen.getByTestId('guess-input') as HTMLInputElement;
    const wrongGuess = params.code.map(() => 0).join('');
    fireEvent.change(input, { target: { value: wrongGuess } });
    fireEvent.click(screen.getByTestId('guess-submit'));
    expect(input.value).toBe('');
  });
});

// ── Progress bar ──────────────────────────────────────────────────────────────

describe('SafeCrackComponent — progress bar', () => {
  it('renders the progress bar', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('sc-progress')).toBeInTheDocument();
  });

  it('uses data (cyan) fill class', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('sc-progress-fill').className).toContain('mg-progress-bar__fill--data');
  });

  it('progress fill grows as guesses are used', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const fill = screen.getByTestId('sc-progress-fill');
    expect(fill.style.width).toBe('0%');
    const input = screen.getByTestId('guess-input');
    const wrongGuess = params.code.map(() => 0).join('');
    fireEvent.change(input, { target: { value: wrongGuess } });
    fireEvent.click(screen.getByTestId('guess-submit'));
    const pct = parseFloat(fill.style.width);
    expect(pct).toBeGreaterThan(0);
  });

  it('shows guesses used label', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('guesses-remaining').textContent).toContain('Guesses used');
  });
});

// ── Stethoscope boost ─────────────────────────────────────────────────────────

describe('SafeCrackComponent — Stethoscope boost', () => {
  it('stethoscope hint not visible initially', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    expect(screen.queryByTestId('stethoscope-hint')).toBeNull();
  });

  it('stethoscope hint appears after boost fires', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('boost-tech'));
    expect(screen.getByTestId('stethoscope-hint')).toBeInTheDocument();
  });

  it('stethoscope hint shows GM-only code with masked digits', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('boost-tech'));
    const hint = screen.getByTestId('stethoscope-hint');
    // Should contain the revealed digit and underscores
    expect(hint.textContent).toMatch(/\d/);
  });
});

// ── Boost slot (no layout shift) ──────────────────────────────────────────────

describe('SafeCrackComponent — boost slot', () => {
  it('mg-boost-slot always rendered regardless of boost eligibility', () => {
    const params = makeParams(1);
    render(
      <SafeCrackComponent
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

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('SafeCrackComponent — onResolve', () => {
  it('calls onResolve when Call Outcome clicked', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('calls onResolve with botched when no guesses submitted', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });

  it('calls onResolve with clean when code is solved with guesses remaining', () => {
    const params = { ...makeParams(1), code: [1, 2, 3], guessBudget: 5 };
    const spy = vi.fn();
    render(
      <SafeCrackComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    const input = screen.getByTestId('guess-input');
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.click(screen.getByTestId('guess-submit'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('clean');
  });
});
