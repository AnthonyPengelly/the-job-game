// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OutcomeJudge } from './OutcomeJudge';

afterEach(cleanup);

describe('OutcomeJudge', () => {
  it('defaults to the suggested outcome', () => {
    render(<OutcomeJudge suggested="complication" onConfirm={() => {}} />);
    expect(screen.getByTestId('outcome-option-complication')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('outcome-option-clean')).toHaveAttribute('data-selected', 'false');
    expect(screen.getByTestId('outcome-option-botched')).toHaveAttribute('data-selected', 'false');
  });

  it('defaults to clean when suggested is clean', () => {
    render(<OutcomeJudge suggested="clean" onConfirm={() => {}} />);
    expect(screen.getByTestId('outcome-option-clean')).toHaveAttribute('data-selected', 'true');
  });

  it('emits the suggested outcome on confirm without interaction', () => {
    const onConfirm = vi.fn();
    render(<OutcomeJudge suggested="complication" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('outcome-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('complication');
  });

  it('emits the GM-chosen outcome when overridden before confirm', () => {
    const onConfirm = vi.fn();
    render(<OutcomeJudge suggested="complication" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('outcome-option-botched'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('botched');
  });

  it('allows switching between outcomes before confirming', () => {
    const onConfirm = vi.fn();
    render(<OutcomeJudge suggested="botched" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('outcome-option-clean'));
    fireEvent.click(screen.getByTestId('outcome-option-complication'));
    fireEvent.click(screen.getByTestId('outcome-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('complication');
  });

  it('renders all three outcome options', () => {
    render(<OutcomeJudge suggested="clean" onConfirm={() => {}} />);
    expect(screen.getByTestId('outcome-option-clean')).toBeDefined();
    expect(screen.getByTestId('outcome-option-complication')).toBeDefined();
    expect(screen.getByTestId('outcome-option-botched')).toBeDefined();
  });

  it('marks the suggested tier with an "App suggests" badge', () => {
    render(<OutcomeJudge suggested="complication" onConfirm={() => {}} />);
    expect(screen.getByTestId('outcome-suggested-complication')).toBeInTheDocument();
    expect(screen.queryByTestId('outcome-suggested-clean')).toBeNull();
    expect(screen.queryByTestId('outcome-suggested-botched')).toBeNull();
  });

  it('renders the per-tier consequence preview when provided', () => {
    render(
      <OutcomeJudge
        suggested="clean"
        onConfirm={() => {}}
        consequences={{
          clean: { heatDelta: 1, lootLabel: '+$25k', gearNote: 'Drop kept' },
          complication: { heatDelta: 2, lootLabel: '+$12.5k', gearNote: 'Drop kept' },
          botched: { heatDelta: 3, lootLabel: '$0', gearNote: 'Drop lost' },
        }}
      />,
    );
    expect(screen.getByTestId('outcome-consq-clean').textContent).toContain('+1');
    expect(screen.getByTestId('outcome-consq-clean').textContent).toContain('+$25k');
    expect(screen.getByTestId('outcome-consq-clean').textContent).toContain('Drop kept');
    expect(screen.getByTestId('outcome-consq-botched').textContent).toContain('+3');
    expect(screen.getByTestId('outcome-consq-botched').textContent).toContain('Drop lost');
  });

  it('renders no consequence rows without the prop (bare suggestion still works)', () => {
    render(<OutcomeJudge suggested="clean" onConfirm={() => {}} />);
    expect(screen.queryByTestId('outcome-consq-clean')).toBeNull();
  });
});
