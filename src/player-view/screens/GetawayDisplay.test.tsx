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

  // ── Progress dots ─────────────────────────────────────────────────────────────

  it('renders progress dots container', () => {
    render(<GetawayDisplay slice={baseSlice} />);
    expect(screen.getByTestId('getaway-progdots')).toBeInTheDocument();
  });

  it('renders one dot per targetCards', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, targetCards: 8, cardsCleared: 3 }} />);
    const dots = screen.getByTestId('getaway-progdots').querySelectorAll('.d');
    expect(dots.length).toBe(8);
  });

  it('cleared dots have "on" class', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, targetCards: 8, cardsCleared: 3 }} />);
    const dots = Array.from(screen.getByTestId('getaway-progdots').querySelectorAll('.d'));
    const onDots = dots.filter(d => d.classList.contains('on'));
    expect(onDots.length).toBe(3);
  });

  it('remaining dots have "left" class when in danger', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, targetCards: 8, cardsCleared: 7, secondsRemaining: 7, gameActive: true }} />);
    const dots = Array.from(screen.getByTestId('getaway-progdots').querySelectorAll('.d'));
    const leftDots = dots.filter(d => d.classList.contains('left'));
    expect(leftDots.length).toBe(1);
  });

  it('remaining dots do not have "left" class when not in danger', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, targetCards: 8, cardsCleared: 3, secondsRemaining: 45 }} />);
    const dots = Array.from(screen.getByTestId('getaway-progdots').querySelectorAll('.d'));
    const leftDots = dots.filter(d => d.classList.contains('left'));
    expect(leftDots.length).toBe(0);
  });

  // ── Clock sub-label ───────────────────────────────────────────────────────────

  it('renders clock sub-label', () => {
    render(<GetawayDisplay slice={baseSlice} />);
    expect(screen.getByTestId('getaway-clock-sub')).toBeInTheDocument();
  });

  it('sub-label shows "cleared" text when active and safe', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, cardsCleared: 3, targetCards: 8, secondsRemaining: 45, gameActive: true }} />);
    expect(screen.getByTestId('getaway-clock-sub').textContent).toContain('cleared');
  });

  it('sub-label shows "go!" text when danger', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, secondsRemaining: 5, gameActive: true }} />);
    expect(screen.getByTestId('getaway-clock-sub').textContent).toContain('go!');
  });

  it('sub-label has danger class when near-bust', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, secondsRemaining: 10, gameActive: true }} />);
    expect(screen.getByTestId('getaway-clock-sub').classList.contains('danger')).toBe(true);
  });

  it('sub-label shows "Waiting" when not gameActive', () => {
    render(<GetawayDisplay slice={{ ...baseSlice, gameActive: false }} />);
    expect(screen.getByTestId('getaway-clock-sub').textContent).toContain('Waiting');
  });

  // ── GM-only data isolation ────────────────────────────────────────────────────

  it('does not render any Heat or loot value', () => {
    render(<GetawayDisplay slice={baseSlice} />);
    const html = screen.getByTestId('getaway-display').innerHTML;
    expect(html).not.toMatch(/\bheat\b/i);
    expect(html).not.toMatch(/\bloot\b/i);
    expect(html).not.toMatch(/\bodds\b/i);
  });
});
