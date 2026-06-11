// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { DefuseComponent } from './component';
import { publishSlice } from '@/platform/channel';

// Suppress publishSlice broadcast in tests
vi.mock('@/platform/channel', () => ({
  publishSlice: vi.fn(),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted(withCharmOrStealth = false) {
  return [
    {
      id: 'p1' as import('@/engine').PlayerId,
      name: 'Millie',
      stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
      powerUps: withCharmOrStealth ? { charm: true as const } : {},
    },
    {
      id: 'p2' as import('@/engine').PlayerId,
      name: 'Liv',
      stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
      powerUps: {},
    },
  ];
}

function renderGame(opts: { boost?: boolean; onResolve?: (o: string) => void } = {}) {
  const params = makeParams(1);
  render(
    <DefuseComponent
      params={params}
      dial={dial}
      committed={makeCommitted(opts.boost ?? false)}
      onResolve={(opts.onResolve ?? (() => {})) as never}
    />,
  );
  return params;
}

function dealWires() {
  fireEvent.click(screen.getByTestId('defuse-dealt'));
}

// ── Setup panel ───────────────────────────────────────────────────────────────

describe('DefuseComponent — setup panel', () => {
  it('states how many cards to deal as the wires', () => {
    const params = renderGame();
    expect(screen.getByTestId('defuse-setup').textContent).toContain(
      `${params.wireCount} cards face-up`,
    );
  });

  it('timer does not run during setup; starts once wires are dealt', () => {
    renderGame();
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    dealWires();
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });

  it('record controls appear only after the deal', () => {
    renderGame();
    expect(screen.queryByTestId('defuse-record-controls')).not.toBeInTheDocument();
    dealWires();
    expect(screen.getByTestId('defuse-record-controls')).toBeInTheDocument();
  });
});

// ── Player-view publishing ────────────────────────────────────────────────────

describe('DefuseComponent — player-view slice', () => {
  it('publishes the rulebook slice on mount (rules text only)', () => {
    const params = renderGame();
    expect(publishSlice).toHaveBeenCalledWith({
      kind: 'defuse-rulebook',
      rules: params.cutRules.map(r => r.text),
      gameActive: true,
    });
  });
});

// ── Recording ─────────────────────────────────────────────────────────────────

describe('DefuseComponent — GM recording', () => {
  it('safe cut increments the tally', () => {
    renderGame();
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-safe-cut'));
    fireEvent.click(screen.getByTestId('defuse-safe-cut'));
    expect(screen.getByTestId('defuse-progress').textContent).toContain('2');
  });

  it('wrong cut trips the alarm badge and removes the controls', () => {
    renderGame();
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-wrong-cut'));
    expect(screen.getByTestId('defuse-badge').textContent).toContain('ALARM');
    expect(screen.queryByTestId('defuse-record-controls')).not.toBeInTheDocument();
  });

  it('all clear shows the DEFUSED badge', () => {
    renderGame();
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-safe-cut'));
    fireEvent.click(screen.getByTestId('defuse-all-clear'));
    expect(screen.getByTestId('defuse-badge').textContent).toContain('DEFUSED');
  });
});

// ── GM rulebook ───────────────────────────────────────────────────────────────

describe('DefuseComponent — GM rulebook', () => {
  it('shows every rule in the GM-only fold once dealt', () => {
    const params = renderGame();
    dealWires();
    params.cutRules.forEach((rule, i) => {
      expect(screen.getByTestId(`defuse-gm-rule-${i}`).textContent).toBe(rule.text);
    });
  });
});

// ── Clear Channel boost ───────────────────────────────────────────────────────

describe('DefuseComponent — Clear Channel boost', () => {
  it('active indicator appears after the boost fires', () => {
    renderGame({ boost: true });
    dealWires();
    expect(screen.queryByTestId('defuse-clear-channel-active')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('boost-charm'));
    expect(screen.getByTestId('defuse-clear-channel-active')).toBeInTheDocument();
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('DefuseComponent — onResolve', () => {
  it('in progress → complication suggested', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    dealWires();
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('complication');
  });

  it('all clear → clean', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-all-clear'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('clean');
  });

  it('wrong cut → botched', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-wrong-cut'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });
});
