// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlayerViewApp } from './App';

afterEach(cleanup);

// subscribeToSlice uses BroadcastChannel which is unavailable in jsdom.
// The channel module handles this gracefully (returns no-op). We test the
// default (idle) render path without injecting slices.
vi.mock('@/platform/channel', async (importActual) => {
  const actual = await importActual<typeof import('@/platform/channel')>();
  return {
    ...actual,
    subscribeToSlice: vi.fn(() => () => undefined),
  };
});

describe('PlayerViewApp', () => {
  it('renders idle state by default', () => {
    render(<PlayerViewApp />);
    expect(screen.getByTestId('player-view-idle')).toBeInTheDocument();
  });

  it('wraps idle state in pv class', () => {
    render(<PlayerViewApp />);
    expect(screen.getByTestId('player-view-idle').classList.contains('pv')).toBe(true);
  });
});
