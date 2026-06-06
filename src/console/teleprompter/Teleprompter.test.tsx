// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Teleprompter } from './Teleprompter';

afterEach(cleanup);

describe('Teleprompter', () => {
  it('renders the supplied line', () => {
    render(<Teleprompter line="The vault is on the third floor." onAdvance={() => undefined} />);
    expect(screen.getByTestId('teleprompter-line')).toHaveTextContent(
      'The vault is on the third floor.',
    );
  });

  it('renders an advance control', () => {
    render(<Teleprompter line="Testing." onAdvance={() => undefined} />);
    expect(screen.getByTestId('teleprompter-advance')).toBeInTheDocument();
  });

  it('advance control is never disabled (no dead-end)', () => {
    render(<Teleprompter line="Testing." onAdvance={() => undefined} />);
    const btn = screen.getByTestId('teleprompter-advance');
    expect(btn).not.toBeDisabled();
  });

  it('clicking the advance control calls onAdvance', () => {
    const onAdvance = vi.fn();
    render(<Teleprompter line="Let's move." onAdvance={onAdvance} />);
    fireEvent.click(screen.getByTestId('teleprompter-advance'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('clicking advance multiple times calls onAdvance each time', () => {
    const onAdvance = vi.fn();
    render(<Teleprompter line="Again." onAdvance={onAdvance} />);
    const btn = screen.getByTestId('teleprompter-advance');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onAdvance).toHaveBeenCalledTimes(3);
  });

  it('updates displayed line when the prop changes', () => {
    const { rerender } = render(
      <Teleprompter line="Line one." onAdvance={() => undefined} />,
    );
    expect(screen.getByTestId('teleprompter-line')).toHaveTextContent('Line one.');
    rerender(<Teleprompter line="Line two." onAdvance={() => undefined} />);
    expect(screen.getByTestId('teleprompter-line')).toHaveTextContent('Line two.');
  });

  it('renders an empty line without error', () => {
    expect(() =>
      render(<Teleprompter line="" onAdvance={() => undefined} />),
    ).not.toThrow();
  });
});
