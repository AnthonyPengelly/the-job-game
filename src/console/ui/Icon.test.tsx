// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Check, Megaphone } from 'lucide-react';
import { Icon } from './Icon';

afterEach(cleanup);

describe('Icon', () => {
  it('renders the lucide icon SVG', () => {
    const { container } = render(<Icon icon={Check} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('applies stroke width 1.75', () => {
    const { container } = render(<Icon icon={Check} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('stroke-width')).toBe('1.75');
  });

  it('renders without label: no wrapper span', () => {
    const { container } = render(<Icon icon={Check} />);
    expect(container.querySelector('.icon-labeled')).toBeNull();
  });

  it('renders with label: wraps icon and label in .icon-labeled', () => {
    const { container } = render(<Icon icon={Megaphone} label="READ ALOUD" />);
    const wrap = container.querySelector('.icon-labeled');
    expect(wrap).not.toBeNull();
    expect(wrap?.textContent).toContain('READ ALOUD');
  });

  it('label span has t-label class for mono-caps styling', () => {
    const { container } = render(<Icon icon={Check} label="DONE" />);
    const labelEl = container.querySelector('.icon-label');
    expect(labelEl).not.toBeNull();
    expect(labelEl?.classList.contains('t-label')).toBe(true);
  });

  it('icon SVG is aria-hidden', () => {
    const { container } = render(<Icon icon={Check} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies custom size', () => {
    const { container } = render(<Icon icon={Check} size={24} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
  });

  it('applies custom className when no label', () => {
    const { container } = render(<Icon icon={Check} className="my-class" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('my-class')).toBe(true);
  });
});
