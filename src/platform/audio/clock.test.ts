import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClock } from './clock';

describe('createClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('now() returns 0 when no real context is injected', () => {
    const clock = createClock();
    expect(clock.now()).toBe(0);
  });

  it('now() delegates to injected getTime', () => {
    let t = 1.5;
    const clock = createClock({ getTime: () => t });
    expect(clock.now()).toBe(1.5);
    t = 3.0;
    expect(clock.now()).toBe(3.0);
  });

  it('scheduleAt fires immediately when time is in the past', () => {
    const t = 5;
    const clock = createClock({ getTime: () => t });
    const cb = vi.fn();
    clock.scheduleAt(4, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('scheduleAt fires immediately when time equals now', () => {
    const t = 5;
    const clock = createClock({ getTime: () => t });
    const cb = vi.fn();
    clock.scheduleAt(5, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires scheduled callbacks in order as time advances', () => {
    let t = 0;
    const clock = createClock({ getTime: () => t, lookahead: 0.1, intervalMs: 25 });
    clock.start();

    const order: number[] = [];
    clock.scheduleAt(0.5, () => order.push(1));
    clock.scheduleAt(1.0, () => order.push(2));
    clock.scheduleAt(0.8, () => order.push(3));

    // Nothing fires yet (t=0, lookahead=0.1, earliest is 0.5)
    vi.advanceTimersByTime(25);
    expect(order).toEqual([]);

    // Advance mock audio clock to 0.41 (lookahead of 0.1 reaches 0.51 > 0.5)
    t = 0.41;
    vi.advanceTimersByTime(25);
    expect(order).toEqual([1]);

    // Advance to 0.71 (lookahead reaches 0.81 > 0.8)
    t = 0.71;
    vi.advanceTimersByTime(25);
    expect(order).toEqual([1, 3]);

    // Advance to 0.91 (lookahead reaches 1.01 > 1.0)
    t = 0.91;
    vi.advanceTimersByTime(25);
    expect(order).toEqual([1, 3, 2]);

    clock.stop();
  });

  it('stop() flushes remaining pending callbacks', () => {
    const t = 0;
    const clock = createClock({ getTime: () => t, lookahead: 0.05 });
    clock.start();

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    clock.scheduleAt(10, cb1);
    clock.scheduleAt(20, cb2);

    // Stopping should fire them all
    clock.stop();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('start() is idempotent (calling twice does not double-fire)', () => {
    let t = 0;
    const clock = createClock({ getTime: () => t, lookahead: 0.1, intervalMs: 25 });
    clock.start();
    clock.start();

    const cb = vi.fn();
    clock.scheduleAt(0.05, () => cb());

    t = 0.0;
    vi.advanceTimersByTime(25);
    expect(cb).toHaveBeenCalledTimes(1);

    clock.stop();
  });
});
