// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GetawayDisplay } from './GetawayDisplay';

afterEach(cleanup);

const baseSlice = {
  kind: 'getaway' as const,
  cardsCleared: 3,
  targetCards: 10,
  secondsRemaining: 45,
  clueGiverName: 'Alice',
  clueGiverIndex: 0,
  gameActive: true,
};

describe('GetawayDisplay', () => {
  it('renders with getaway-display testid', () => {
    render(<GetawayDisplay slice={baseSlice} />);
    expect(screen.getByTestId('getaway-display')).toBeInTheDocument();
  });

  it('renders the timer with getaway-timer testid', () => {
    render(<GetawayDisplay slice={baseSlice} />);
    expect(screen.getByTestId('getaway-timer')).toBeInTheDocument();
  });

  it('shows formatted time when gameActive', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, secondsRemaining: 75, gameActive: true }} />);
    expect(screen.getByTestId('getaway-timer').textContent).toBe('1:15');
  });

  it('shows placeholder when not gameActive', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, gameActive: false }} />);
    expect(screen.getByTestId('getaway-timer').textContent).toContain('—');
  });

  it('sets data-remaining attribute on timer element', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, secondsRemaining: 30 }} />);
    expect(screen.getByTestId('getaway-timer').getAttribute('data-remaining')).toBe('30');
  });

  it('applies danger class when time is <= 15 and gameActive', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, secondsRemaining: 10, gameActive: true }} />);
    expect(screen.getByTestId('getaway-timer').classList.contains('danger')).toBe(true);
  });

  it('does not apply danger class when not gameActive even if time low', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, secondsRemaining: 5, gameActive: false }} />);
    expect(screen.getByTestId('getaway-timer').classList.contains('danger')).toBe(false);
  });

  it('does not apply danger class when time is > 15', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, secondsRemaining: 20, gameActive: true }} />);
    expect(screen.getByTestId('getaway-timer').classList.contains('danger')).toBe(false);
  });

  it('renders clue giver name with getaway-clue-giver testid', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, clueGiverName: 'Bob' }} />);
    const el = screen.getByTestId('getaway-clue-giver');
    expect(el).toBeInTheDocument();
    expect(el.textContent).toContain('Bob');
  });

  it('renders cards cleared with getaway-cards-cleared testid', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, cardsCleared: 4, targetCards: 12 }} />);
    const el = screen.getByTestId('getaway-cards-cleared');
    expect(el).toBeInTheDocument();
    expect(el.textContent).toContain('4');
    expect(el.textContent).toContain('12');
  });

  it('applies pv-clock kit class to timer', () => {
    render(<GetawayDisplay slice={baseSlice} />);
    expect(screen.getByTestId('getaway-timer').classList.contains('pv-clock')).toBe(true);
  });

  it('applies pv-inner kit class to root element', () => {
    render(<GetawayDisplay slice={baseSlice} />);
    expect(screen.getByTestId('getaway-display').classList.contains('pv-inner')).toBe(true);
  });
});
