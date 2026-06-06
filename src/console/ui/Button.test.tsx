// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Check, ArrowLeft } from 'lucide-react';
import { Button } from './Button';

afterEach(cleanup);

describe('Button', () => {
  it('renders with default primary kind', () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn.classList.contains('btn')).toBe(true);
    expect(btn.classList.contains('btn-primary')).toBe(true);
  });

  it('renders secondary kind', () => {
    render(<Button kind="secondary">Back</Button>);
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('btn-secondary')).toBe(true);
  });

  it('renders danger kind', () => {
    render(<Button kind="danger">Skip</Button>);
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('btn-danger')).toBe(true);
  });

  it('renders ghost kind', () => {
    render(<Button kind="ghost">Cancel</Button>);
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('btn-ghost')).toBe(true);
  });

  it('applies btn-lg when size=lg', () => {
    render(<Button size="lg">Big</Button>);
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('btn-lg')).toBe(true);
  });

  it('renders leading icon as SVG', () => {
    const { container } = render(<Button icon={ArrowLeft}>Back</Button>);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('calls onClick when clicked', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled=true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('passes data-testid through', () => {
    render(<Button data-testid="my-btn">Test</Button>);
    expect(screen.getByTestId('my-btn')).toBeInTheDocument();
  });

  it('icon SVG has stroke width 1.75', () => {
    const { container } = render(<Button icon={Check}>Done</Button>);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('stroke-width')).toBe('1.75');
  });
});
