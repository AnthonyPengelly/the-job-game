// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { resolveDeal } from './deal';
import { AssemblyLineComponent } from './component';

afterEach(cleanup);

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted(count = 3, withCharmOrPhys = false) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}` as import('@/engine').PlayerId,
    name: `Player${i + 1}`,
    stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
    powerUps: withCharmOrPhys && i === 0 ? { charm: true as const } : {},
  }));
}

function renderGame(opts: { seed?: number; count?: number; boost?: boolean; onResolve?: (o: string) => void } = {}) {
  const params = makeParams(opts.seed ?? 1);
  render(
    <AssemblyLineComponent
      params={params}
      dial={dial}
      committed={makeCommitted(opts.count ?? 3, opts.boost ?? false)}
      onResolve={(opts.onResolve ?? (() => {})) as never}
    />,
  );
  return params;
}

function dealHands() {
  fireEvent.click(screen.getByTestId('al-dealt'));
}

// ── Setup panel ───────────────────────────────────────────────────────────────

describe('AssemblyLineComponent — setup panel', () => {
  it('names one set rank per committed player, all-four pulls, and the hand size', () => {
    const params = renderGame({ count: 3 });
    const deal = resolveDeal(params.rankOrder, params.decoysPerPlayer, 3);
    const setup = screen.getByTestId('al-setup');
    for (const rank of deal.setRanks) {
      expect(setup.textContent).toContain(rank);
    }
    expect(setup.textContent).toContain(`${deal.handSize} cards to each player`);
  });

  it('tally controls only appear after hands are dealt', () => {
    renderGame();
    expect(screen.queryByTestId('al-tally-increment')).not.toBeInTheDocument();
    dealHands();
    expect(screen.getByTestId('al-tally-increment')).toBeInTheDocument();
  });

  it('the timer does not run during setup', () => {
    renderGame();
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    dealHands();
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });
});

// ── Hero number / tally ───────────────────────────────────────────────────────

describe('AssemblyLineComponent — tally', () => {
  it('renders the hero sets number starting at 0', () => {
    renderGame();
    dealHands();
    expect(screen.getByTestId('al-sets-num').textContent).toBe('0');
  });

  it('+1 button increments the hero count', () => {
    renderGame();
    dealHands();
    fireEvent.click(screen.getByTestId('al-tally-increment'));
    expect(screen.getByTestId('al-sets-num').textContent).toBe('1');
  });

  it('undo decrements the hero count', () => {
    renderGame();
    dealHands();
    fireEvent.click(screen.getByTestId('al-tally-increment'));
    fireEvent.click(screen.getByTestId('al-tally-undo'));
    expect(screen.getByTestId('al-sets-num').textContent).toBe('0');
  });
});

// ── Tip-Off rank strip ────────────────────────────────────────────────────────

describe('AssemblyLineComponent — Tip-Off rank strip', () => {
  it('rank strip not shown before Tip-Off fires', () => {
    renderGame({ boost: true });
    dealHands();
    expect(screen.queryByTestId('al-types-revealed')).not.toBeInTheDocument();
  });

  it('rank strip shows the set ranks after Tip-Off fires', () => {
    const params = renderGame({ boost: true });
    dealHands();
    fireEvent.click(screen.getByTestId('boost-charm'));
    const strip = screen.getByTestId('al-types-revealed');
    const deal = resolveDeal(params.rankOrder, params.decoysPerPlayer, 3);
    for (const rank of deal.setRanks) {
      expect(strip.textContent).toContain(rank);
    }
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('AssemblyLineComponent — onResolve', () => {
  it('calls onResolve with judge suggestion', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    dealHands();
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledOnce();
  });
});
