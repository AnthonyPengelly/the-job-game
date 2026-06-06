// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Panel, PanelCard } from './Panel';

afterEach(cleanup);

describe('Panel', () => {
  it('renders with panel class', () => {
    const { container } = render(<Panel>Content</Panel>);
    expect(container.querySelector('.panel')).not.toBeNull();
  });

  it('renders panel-body wrapping children', () => {
    const { container } = render(<Panel>My content</Panel>);
    const body = container.querySelector('.panel-body');
    expect(body?.textContent).toContain('My content');
  });

  it('renders panel-head when title is provided', () => {
    const { container } = render(<Panel title="Order of Play">Content</Panel>);
    const head = container.querySelector('.panel-head');
    expect(head).not.toBeNull();
    expect(head?.querySelector('h3')?.textContent).toBe('Order of Play');
  });

  it('renders panel-tag when tag is provided', () => {
    const { container } = render(<Panel title="Order" tag="Mastermind reveals">Content</Panel>);
    const tag = container.querySelector('.panel-tag');
    expect(tag?.textContent).toBe('Mastermind reveals');
  });

  it('does not render panel-head when neither title nor tag is provided', () => {
    const { container } = render(<Panel>Content</Panel>);
    expect(container.querySelector('.panel-head')).toBeNull();
  });

  it('adds live class when live=true', () => {
    const { container } = render(<Panel live>Live content</Panel>);
    const panel = container.querySelector('.panel');
    expect(panel?.classList.contains('live')).toBe(true);
  });

  it('does not have live class by default', () => {
    const { container } = render(<Panel>Content</Panel>);
    const panel = container.querySelector('.panel');
    expect(panel?.classList.contains('live')).toBe(false);
  });

  it('applies extra className', () => {
    const { container } = render(<Panel className="extra">Content</Panel>);
    const panel = container.querySelector('.panel');
    expect(panel?.classList.contains('extra')).toBe(true);
  });
});

describe('PanelCard', () => {
  it('renders with panel class', () => {
    const { container } = render(<PanelCard>Content</PanelCard>);
    expect(container.querySelector('.panel')).not.toBeNull();
  });

  it('renders children in panel-body', () => {
    const { container } = render(<PanelCard>Card content</PanelCard>);
    const body = container.querySelector('.panel-body');
    expect(body?.textContent).toContain('Card content');
  });

  it('has no panel-head', () => {
    const { container } = render(<PanelCard>Content</PanelCard>);
    expect(container.querySelector('.panel-head')).toBeNull();
  });
});
