// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { AssemblyLineNegotiatedComponent } from './component';

afterEach(cleanup);

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted(count = 2, withCharmOrPhys = false) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}` as import('@/engine').PlayerId,
    name: `Player${i + 1}`,
    stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
    powerUps: withCharmOrPhys && i === 0 ? { charm: true as const } : {},
  }));
}

// ── Hero number ───────────────────────────────────────────────────────────────

describe('AssemblyLineNegotiatedComponent — hero number', () => {
  it('renders the hero sets number starting at 0', () => {
    const params = makeParams(1);
    const committed = makeCommitted(2);
    render(
      <AssemblyLineNegotiatedComponent
        params={params}
        dial={dial}
        committed={committed}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('aln-sets-num').textContent).toBe('0');
  });

  it('+1 button increments the hero count', () => {
    const params = makeParams(1);
    const committed = makeCommitted(2);
    render(
      <AssemblyLineNegotiatedComponent
        params={params}
        dial={dial}
        committed={committed}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('aln-tally-increment'));
    expect(screen.getByTestId('aln-sets-num').textContent).toBe('1');
  });

  it('undo decrements the hero count', () => {
    const params = makeParams(1);
    const committed = makeCommitted(2);
    render(
      <AssemblyLineNegotiatedComponent
        params={params}
        dial={dial}
        committed={committed}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('aln-tally-increment'));
    fireEvent.click(screen.getByTestId('aln-tally-undo'));
    expect(screen.getByTestId('aln-sets-num').textContent).toBe('0');
  });
});

// ── Tip-Off type strip ────────────────────────────────────────────────────────

describe('AssemblyLineNegotiatedComponent — Tip-Off type strip', () => {
  it('type strip not shown before Tip-Off fires', () => {
    const params = makeParams(1);
    const committed = makeCommitted(2, true);
    render(
      <AssemblyLineNegotiatedComponent
        params={params}
        dial={dial}
        committed={committed}
        onResolve={() => {}}
      />,
    );
    expect(screen.queryByTestId('aln-types-revealed')).not.toBeInTheDocument();
  });

  it('type strip shown after Tip-Off fires', () => {
    const params = makeParams(1);
    const committed = makeCommitted(2, true);
    render(
      <AssemblyLineNegotiatedComponent
        params={params}
        dial={dial}
        committed={committed}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('boost-charm'));
    expect(screen.getByTestId('aln-types-revealed')).toBeInTheDocument();
    for (const t of params.setTypesInPlay) {
      expect(screen.getByTestId('aln-types-revealed').textContent).toContain(t);
    }
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('AssemblyLineNegotiatedComponent — onResolve', () => {
  it('calls onResolve with judge suggestion', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <AssemblyLineNegotiatedComponent
        params={params}
        dial={dial}
        committed={makeCommitted(2)}
        onResolve={spy}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledOnce();
  });
});

// ── Boost slot (no layout shift) ──────────────────────────────────────────────

describe('AssemblyLineNegotiatedComponent — boost slot', () => {
  it('mg-boost-slot always rendered', () => {
    const params = makeParams(1);
    render(
      <AssemblyLineNegotiatedComponent
        params={params}
        dial={dial}
        committed={makeCommitted(2, false)}
        onResolve={() => {}}
      />,
    );
    const slots = document.querySelectorAll('.mg-boost-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Progress bar ──────────────────────────────────────────────────────────────

describe('AssemblyLineNegotiatedComponent — progress bar', () => {
  it('progress bar rendered', () => {
    const params = makeParams(1);
    render(
      <AssemblyLineNegotiatedComponent
        params={params}
        dial={dial}
        committed={makeCommitted(2)}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('aln-progress')).toBeInTheDocument();
  });
});
