// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Checklist } from './Checklist';

afterEach(cleanup);

describe('Checklist', () => {
  const items = [
    { label: 'Shuffle the Room deck', done: true },
    { label: 'Deal one Gear card', done: true },
    { label: 'Set the Heat track to zero' },
    { label: 'Read the Briefing aloud' },
  ];

  it('renders with checklist class', () => {
    const { container } = render(<Checklist items={items} />);
    expect(container.querySelector('.checklist')).not.toBeNull();
  });

  it('renders the correct number of items', () => {
    const { container } = render(<Checklist items={items} />);
    const checks = container.querySelectorAll('.check');
    expect(checks.length).toBe(4);
  });

  it('adds done class to completed items', () => {
    const { container } = render(<Checklist items={items} />);
    const checks = container.querySelectorAll('.check');
    expect(checks[0]?.classList.contains('done')).toBe(true);
    expect(checks[1]?.classList.contains('done')).toBe(true);
  });

  it('does not add done class to incomplete items', () => {
    const { container } = render(<Checklist items={items} />);
    const checks = container.querySelectorAll('.check');
    expect(checks[2]?.classList.contains('done')).toBe(false);
    expect(checks[3]?.classList.contains('done')).toBe(false);
  });

  it('renders checkmark icon for done items', () => {
    const { container } = render(<Checklist items={items} />);
    const checks = container.querySelectorAll('.check');
    expect(checks[0]?.querySelector('svg')).not.toBeNull();
  });

  it('does not render checkmark icon for incomplete items', () => {
    const { container } = render(<Checklist items={items} />);
    const checks = container.querySelectorAll('.check');
    expect(checks[2]?.querySelector('svg')).toBeNull();
  });

  it('renders label text for each item', () => {
    const { container } = render(<Checklist items={items} />);
    expect(container.textContent).toContain('Shuffle the Room deck');
    expect(container.textContent).toContain('Read the Briefing aloud');
  });

  it('renders empty list without error', () => {
    expect(() => render(<Checklist items={[]} />)).not.toThrow();
  });
});
