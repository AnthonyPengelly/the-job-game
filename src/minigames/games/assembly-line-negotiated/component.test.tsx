// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { resolveDeal } from '@/minigames/games/assembly-line/deal';
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

function renderGame(opts: { seed?: number; boost?: boolean; onResolve?: (o: string) => void } = {}) {
  const params = makeParams(opts.seed ?? 1);
  render(
    <AssemblyLineNegotiatedComponent
      params={params}
      dial={dial}
      committed={makeCommitted(2, opts.boost ?? false)}
      onResolve={(opts.onResolve ?? (() => {})) as never}
    />,
  );
  return params;
}

function dealHands() {
  fireEvent.click(screen.getByTestId('aln-dealt'));
}

// ── Setup panel ───────────────────────────────────────────────────────────────

describe('AssemblyLineNegotiatedComponent — setup panel', () => {
  it('names one set rank per player and the hand size', () => {
    const params = renderGame();
    const deal = resolveDeal(params.rankOrder, params.decoysPerPlayer, 2);
    const setup = screen.getByTestId('aln-setup');
    for (const rank of deal.setRanks) {
      expect(setup.textContent).toContain(rank);
    }
    expect(setup.textContent).toContain(`${deal.handSize} cards to each player`);
  });

  it('tally controls only appear after hands are dealt', () => {
    renderGame();
    expect(screen.queryByTestId('aln-tally-increment')).not.toBeInTheDocument();
    dealHands();
    expect(screen.getByTestId('aln-tally-increment')).toBeInTheDocument();
  });
});

// ── Tally ────────────────────────────────────────────────────────────────────

describe('AssemblyLineNegotiatedComponent — tally', () => {
  it('+1 then undo returns the hero count to 0', () => {
    renderGame();
    dealHands();
    fireEvent.click(screen.getByTestId('aln-tally-increment'));
    expect(screen.getByTestId('aln-sets-num').textContent).toBe('1');
    fireEvent.click(screen.getByTestId('aln-tally-undo'));
    expect(screen.getByTestId('aln-sets-num').textContent).toBe('0');
  });
});

// ── Tip-Off rank strip ────────────────────────────────────────────────────────

describe('AssemblyLineNegotiatedComponent — Tip-Off rank strip', () => {
  it('rank strip not shown before Tip-Off fires', () => {
    renderGame({ boost: true });
    dealHands();
    expect(screen.queryByTestId('aln-types-revealed')).not.toBeInTheDocument();
  });

  it('rank strip shows the set ranks after Tip-Off fires', () => {
    const params = renderGame({ boost: true });
    dealHands();
    fireEvent.click(screen.getByTestId('boost-charm'));
    const strip = screen.getByTestId('aln-types-revealed');
    const deal = resolveDeal(params.rankOrder, params.decoysPerPlayer, 2);
    for (const rank of deal.setRanks) {
      expect(strip.textContent).toContain(rank);
    }
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('AssemblyLineNegotiatedComponent — onResolve', () => {
  it('calls onResolve with judge suggestion', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    dealHands();
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledOnce();
  });
});
