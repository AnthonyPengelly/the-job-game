// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BoostButton } from './BoostButton';
import type { BoostHook, CommittedPlayer } from '@/minigames/contract';
import type { Lane, PlayerId } from '@/engine';

afterEach(cleanup);

type State = { used: boolean };
type Params = Record<string, never>;

const HOOK: BoostHook<State, Params> = {
  lane: 'tech',
  label: 'Stethoscope',
  apply: (state) => ({ ...state, used: true }),
};

function pid(s: string): PlayerId {
  return s as PlayerId;
}

const HOLDER: CommittedPlayer = {
  id: pid('p1'),
  name: 'Alice',
  stats: { tech: 3, physical: 1, charm: 1, stealth: 1 },
  powerUps: { tech: true },
};

const NO_HOLDER: CommittedPlayer = {
  id: pid('p2'),
  name: 'Bob',
  stats: { tech: 1, physical: 1, charm: 1, stealth: 1 },
  powerUps: {},
};

const GAME_LANES: Lane[] = ['tech', 'stealth'];

describe('BoostButton', () => {
  it('returns null when no committed player holds any game lane power-up', () => {
    const { container } = render(
      <BoostButton hook={HOOK} gameLanes={GAME_LANES} committed={[NO_HOLDER]} onFire={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a button when a committed player holds the hook lane power-up', () => {
    render(<BoostButton hook={HOOK} gameLanes={GAME_LANES} committed={[HOLDER]} onFire={() => {}} />);
    expect(screen.getByTestId('boost-tech')).toBeDefined();
    expect(screen.getByTestId('boost-tech')).not.toBeDisabled();
  });

  it('fires onFire exactly once when clicked', () => {
    const onFire = vi.fn();
    render(<BoostButton hook={HOOK} gameLanes={GAME_LANES} committed={[HOLDER]} onFire={onFire} />);
    const btn = screen.getByTestId('boost-tech');
    fireEvent.click(btn);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith(HOOK);
  });

  it('disables after one fire', () => {
    render(<BoostButton hook={HOOK} gameLanes={GAME_LANES} committed={[HOLDER]} onFire={() => {}} />);
    const btn = screen.getByTestId('boost-tech');
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it('does not call onFire again when clicked while disabled', () => {
    const onFire = vi.fn();
    render(<BoostButton hook={HOOK} gameLanes={GAME_LANES} committed={[HOLDER]} onFire={onFire} />);
    const btn = screen.getByTestId('boost-tech');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('renders when any committed player holds a lane power-up (mixed crew)', () => {
    render(<BoostButton hook={HOOK} gameLanes={GAME_LANES} committed={[NO_HOLDER, HOLDER]} onFire={() => {}} />);
    expect(screen.getByTestId('boost-tech')).toBeDefined();
  });

  it('fires for holder of the OTHER game lane (any-lane eligibility)', () => {
    // Hook is 'tech' but gameLanes = ['tech', 'stealth']; player only holds stealth
    const stealthHolder: CommittedPlayer = {
      id: pid('p3'),
      name: 'Carol',
      stats: { tech: 1, physical: 1, charm: 1, stealth: 3 },
      powerUps: { stealth: true },
    };
    render(
      <BoostButton hook={HOOK} gameLanes={['tech', 'stealth']} committed={[stealthHolder]} onFire={() => {}} />,
    );
    expect(screen.getByTestId('boost-tech')).toBeDefined();
  });

  it('returns null when player holds a different lane power-up not in gameLanes', () => {
    const charmHolder: CommittedPlayer = {
      id: pid('p4'),
      name: 'Dan',
      stats: { tech: 1, physical: 1, charm: 3, stealth: 1 },
      powerUps: { charm: true },
    };
    const { container } = render(
      <BoostButton hook={HOOK} gameLanes={['tech', 'stealth']} committed={[charmHolder]} onFire={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
