// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { Timer } from './Timer';
import { AudioClockContext } from './AudioClockContext';

afterEach(cleanup);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Timer', () => {
  it('renders the initial time', () => {
    render(<Timer seconds={30} running={false} onExpire={() => {}} />);
    expect(screen.getByTestId('timer')).toHaveAttribute('data-remaining', '30');
  });

  it('calls onExpire when countdown reaches zero', () => {
    const onExpire = vi.fn();
    render(<Timer seconds={3} running={true} onExpire={onExpire} audible={false} />);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(onExpire).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(onExpire).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('does not call onExpire when not running', () => {
    const onExpire = vi.fn();
    render(<Timer seconds={2} running={false} onExpire={onExpire} audible={false} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('does not call onExpire more than once', () => {
    const onExpire = vi.fn();
    render(<Timer seconds={1} running={true} onExpire={onExpire} audible={false} />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('shows 0:00 after expiry', () => {
    const onExpire = vi.fn();
    render(<Timer seconds={1} running={true} onExpire={onExpire} audible={false} />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByTestId('timer')).toHaveAttribute('data-remaining', '0');
  });

  it('calls onTick each second with remaining value', () => {
    const onExpire = vi.fn();
    const onTick = vi.fn();
    render(<Timer seconds={3} running={true} onExpire={onExpire} onTick={onTick} audible={false} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onTick).toHaveBeenCalledWith(2);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onTick).toHaveBeenCalledWith(1);
  });
});

// ── Timer soundscape (playtest wave 2: tense bed while the clock runs) ────────

describe('Timer — soundscape signal', () => {
  function renderWithSoundscape(props: { seconds: number; running: boolean }) {
    const setTimerSoundscape = vi.fn();
    const handle = {
      clock: { start: () => {}, stop: () => {}, onTick: () => () => {}, now: () => 0 },
      scheduleBeep: () => {},
      setTimerSoundscape,
    } as unknown as import('./AudioClockContext').AudioClockHandle;
    const view = render(
      <AudioClockContext.Provider value={handle}>
        <Timer seconds={props.seconds} running={props.running} onExpire={() => {}} audible={false} />
      </AudioClockContext.Provider>,
    );
    return { setTimerSoundscape, ...view };
  }

  it('signals active when running and inactive on unmount', () => {
    const { setTimerSoundscape, unmount } = renderWithSoundscape({ seconds: 10, running: true });
    expect(setTimerSoundscape).toHaveBeenLastCalledWith(true);
    unmount();
    expect(setTimerSoundscape).toHaveBeenLastCalledWith(false);
  });

  it('signals inactive when the countdown expires', () => {
    const { setTimerSoundscape } = renderWithSoundscape({ seconds: 2, running: true });
    expect(setTimerSoundscape).toHaveBeenLastCalledWith(true);
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(setTimerSoundscape).toHaveBeenLastCalledWith(false);
  });

  it('does not signal when not running', () => {
    const { setTimerSoundscape } = renderWithSoundscape({ seconds: 10, running: false });
    expect(setTimerSoundscape).not.toHaveBeenCalled();
  });

  it('renders fine without a provider (no-op)', () => {
    render(<Timer seconds={5} running={true} onExpire={() => {}} audible={false} />);
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });
});
