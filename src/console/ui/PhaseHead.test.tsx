// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PhaseHead } from './PhaseHead';

afterEach(cleanup);

describe('PhaseHead', () => {
  it('renders with phase-head class', () => {
    const { container } = render(<PhaseHead eyebrow="01 · Setup" title="Assemble the Crew" />);
    expect(container.querySelector('.phase-head')).not.toBeNull();
  });

  it('renders the eyebrow text with phase-eyebrow class', () => {
    const { container } = render(<PhaseHead eyebrow="01 · Setup" title="Assemble the Crew" />);
    const eyebrow = container.querySelector('.phase-eyebrow');
    expect(eyebrow?.textContent).toBe('01 · Setup');
  });

  it('renders the title with phase-title class', () => {
    const { container } = render(<PhaseHead eyebrow="01 · Setup" title="Assemble the Crew" />);
    const title = container.querySelector('.phase-title');
    expect(title?.textContent).toBe('Assemble the Crew');
  });

  it('renders aside when provided', () => {
    const { container } = render(
      <PhaseHead eyebrow="02 · Briefing" title="The Briefing" aside={<span>TONIGHT&apos;S MARK</span>} />,
    );
    const aside = container.querySelector('.phase-aside');
    expect(aside).not.toBeNull();
    expect(aside?.textContent).toContain("TONIGHT'S MARK");
  });

  it('does not render phase-aside when aside is not provided', () => {
    const { container } = render(<PhaseHead eyebrow="01 · Setup" title="Assemble" />);
    expect(container.querySelector('.phase-aside')).toBeNull();
  });
});
