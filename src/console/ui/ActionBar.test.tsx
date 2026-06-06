// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ActionBar } from './ActionBar';

afterEach(cleanup);

describe('ActionBar', () => {
  it('renders with actionbar class', () => {
    const { container } = render(<ActionBar />);
    expect(container.querySelector('.actionbar')).not.toBeNull();
  });

  it('renders left group when left is provided', () => {
    const { container } = render(<ActionBar left={<button>Back</button>} />);
    const grps = container.querySelectorAll('.grp');
    expect(grps.length).toBe(1);
    expect(grps[0]?.textContent).toContain('Back');
  });

  it('renders right group when right is provided', () => {
    const { container } = render(<ActionBar right={<button>Next</button>} />);
    const grps = container.querySelectorAll('.grp');
    expect(grps.length).toBe(1);
    expect(grps[0]?.textContent).toContain('Next');
  });

  it('renders both groups when left and right are provided', () => {
    const { container } = render(
      <ActionBar left={<button>Back</button>} right={<button>Next</button>} />,
    );
    const grps = container.querySelectorAll('.grp');
    expect(grps.length).toBe(2);
  });

  it('renders no groups when neither left nor right is provided', () => {
    const { container } = render(<ActionBar />);
    expect(container.querySelectorAll('.grp').length).toBe(0);
  });
});
