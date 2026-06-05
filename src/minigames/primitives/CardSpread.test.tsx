// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CardSpread } from './CardSpread';
import type { Card, CardId } from './CardSpread';

afterEach(cleanup);

function id(s: string): CardId {
  return s as CardId;
}

const CARDS: Card[] = [
  { id: id('c1'), label: 'Ace' },
  { id: id('c2'), label: 'King' },
  { id: id('c3'), label: 'Queen' },
];

describe('CardSpread', () => {
  it('renders all cards', () => {
    render(<CardSpread cards={CARDS} layout="row" />);
    expect(screen.getByTestId('card-c1')).toBeDefined();
    expect(screen.getByTestId('card-c2')).toBeDefined();
    expect(screen.getByTestId('card-c3')).toBeDefined();
  });

  it('renders card labels face-up', () => {
    render(<CardSpread cards={CARDS} layout="row" />);
    expect(screen.getByTestId('card-c1')).toHaveTextContent('Ace');
    expect(screen.getByTestId('card-c2')).toHaveTextContent('King');
  });

  it('marks faceDown cards with data-face-down=true', () => {
    render(<CardSpread cards={CARDS} layout="row" faceDown={[id('c2')]} />);
    expect(screen.getByTestId('card-c1')).toHaveAttribute('data-face-down', 'false');
    expect(screen.getByTestId('card-c2')).toHaveAttribute('data-face-down', 'true');
  });

  it('calls onTap with the card id when tapped', () => {
    const onTap = vi.fn();
    render(<CardSpread cards={CARDS} layout="row" onTap={onTap} />);
    fireEvent.click(screen.getByTestId('card-c1'));
    expect(onTap).toHaveBeenCalledWith(id('c1'));
  });

  it('renders in grid layout', () => {
    render(<CardSpread cards={CARDS} layout="grid" />);
    const spread = screen.getByTestId('card-spread');
    expect(spread.style.display).toBe('grid');
  });

  it('renders empty spread without crashing', () => {
    render(<CardSpread cards={[]} layout="row" />);
    expect(screen.getByTestId('card-spread')).toBeDefined();
  });
});
