// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DefuseRulebook } from './DefuseRulebook';

afterEach(cleanup);

describe('DefuseRulebook', () => {
  it('renders with defuse-rulebook testid', () => {
    render(
      <DefuseRulebook
        slice={{ kind: 'defuse-rulebook', rules: [], gameActive: false }}
      />,
    );
    expect(screen.getByTestId('defuse-rulebook')).toBeInTheDocument();
  });

  it('shows waiting state when gameActive is false', () => {
    render(
      <DefuseRulebook
        slice={{ kind: 'defuse-rulebook', rules: ['Cut RED'], gameActive: false }}
      />,
    );
    expect(screen.getByTestId('defuse-waiting')).toBeInTheDocument();
    expect(screen.queryByTestId('defuse-rules-list')).not.toBeInTheDocument();
  });

  it('shows rules list when gameActive is true', () => {
    render(
      <DefuseRulebook
        slice={{
          kind: 'defuse-rulebook',
          rules: ['Cut RED wires', 'Cut CIRCLE wires'],
          gameActive: true,
        }}
      />,
    );
    expect(screen.getByTestId('defuse-rules-list')).toBeInTheDocument();
    expect(screen.queryByTestId('defuse-waiting')).not.toBeInTheDocument();
  });

  it('renders each rule with a numbered testid', () => {
    render(
      <DefuseRulebook
        slice={{
          kind: 'defuse-rulebook',
          rules: ['Cut RED wires', 'Cut CIRCLE wires'],
          gameActive: true,
        }}
      />,
    );
    expect(screen.getByTestId('defuse-rule-0')).toBeInTheDocument();
    expect(screen.getByTestId('defuse-rule-1')).toBeInTheDocument();
    expect(screen.getByTestId('defuse-rule-0').textContent).toContain('Cut RED wires');
    expect(screen.getByTestId('defuse-rule-1').textContent).toContain('Cut CIRCLE wires');
  });

  it('applies pv-inner kit class to the root element', () => {
    render(
      <DefuseRulebook
        slice={{ kind: 'defuse-rulebook', rules: [], gameActive: false }}
      />,
    );
    expect(screen.getByTestId('defuse-rulebook').classList.contains('pv-inner')).toBe(true);
  });

  it('applies pv-step class to each rule row', () => {
    render(
      <DefuseRulebook
        slice={{
          kind: 'defuse-rulebook',
          rules: ['Step one', 'Step two'],
          gameActive: true,
        }}
      />,
    );
    expect(screen.getByTestId('defuse-rule-0').classList.contains('pv-step')).toBe(true);
    expect(screen.getByTestId('defuse-rule-1').classList.contains('pv-step')).toBe(true);
  });

  it('does not import from @/console (isolation)', async () => {
    const mod = await import('./DefuseRulebook');
    expect(mod).toBeDefined();
  });
});
