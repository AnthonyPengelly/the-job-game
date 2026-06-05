// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DialReadout } from './DialReadout';

afterEach(cleanup);

describe('DialReadout', () => {
  it('displays the difficulty level', () => {
    render(<DialReadout dial={{ level: 3.5 }} />);
    expect(screen.getByTestId('dial-readout')).toBeDefined();
    expect(screen.getByTestId('dial-level')).toHaveTextContent('3.5');
  });

  it('rounds to one decimal place', () => {
    render(<DialReadout dial={{ level: 2 }} />);
    expect(screen.getByTestId('dial-level')).toHaveTextContent('2.0');
  });

  it('carries aria-label for accessibility', () => {
    render(<DialReadout dial={{ level: 5 }} />);
    expect(screen.getByTestId('dial-readout')).toHaveAttribute('aria-label', 'Difficulty: 5');
  });
});
