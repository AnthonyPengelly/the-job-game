// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { publishSlice, subscribeToSlice, _clearPlayerWindowsForTesting } from './channel';
import type { PlayerViewSlice } from './slice';

const idleSlice: PlayerViewSlice = { kind: 'idle' };
const getawaySlice: PlayerViewSlice = {
  kind: 'getaway',
  cardsCleared: 2,
  targetCards: 8,
  secondsRemaining: 30,
  clueGiverName: 'Bob',
  clueGiverIndex: 1,
  gameActive: true,
};

beforeEach(() => {
  _clearPlayerWindowsForTesting();
});

// ── subscribeToSlice — window.postMessage transport ───────────────────────────

describe('subscribeToSlice — postMessage transport', () => {
  afterEach(() => {
    _clearPlayerWindowsForTesting();
  });

  it('calls callback when a valid player-slice message arrives on window', () => {
    const received: PlayerViewSlice[] = [];
    const unsub = subscribeToSlice(s => received.push(s));

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-slice', payload: JSON.stringify(idleSlice) },
      }),
    );

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(idleSlice);
    unsub();
  });

  it('calls callback with a getaway slice over postMessage', () => {
    const received: PlayerViewSlice[] = [];
    const unsub = subscribeToSlice(s => received.push(s));

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-slice', payload: JSON.stringify(getawaySlice) },
      }),
    );

    expect(received).toHaveLength(1);
    const slice = received[0]!;
    expect(slice.kind).toBe('getaway');
    unsub();
  });

  it('ignores window messages with an unrelated type', () => {
    const received: PlayerViewSlice[] = [];
    const unsub = subscribeToSlice(s => received.push(s));

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'some-other-type', payload: JSON.stringify(idleSlice) },
      }),
    );

    expect(received).toHaveLength(0);
    unsub();
  });

  it('ignores window messages with non-object data', () => {
    const received: PlayerViewSlice[] = [];
    const unsub = subscribeToSlice(s => received.push(s));

    window.dispatchEvent(new MessageEvent('message', { data: 'plain string' }));
    window.dispatchEvent(new MessageEvent('message', { data: null }));
    window.dispatchEvent(new MessageEvent('message', { data: 42 }));

    expect(received).toHaveLength(0);
    unsub();
  });

  it('discards malformed payload silently', () => {
    const received: PlayerViewSlice[] = [];
    const unsub = subscribeToSlice(s => received.push(s));

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-slice', payload: '{"kind":"unknown-kind"}' },
      }),
    );

    expect(received).toHaveLength(0);
    unsub();
  });

  it('strips GM-only fields from postMessage payload (isolation)', () => {
    const received: PlayerViewSlice[] = [];
    const unsub = subscribeToSlice(s => received.push(s));

    const sliceWithGmFields = {
      ...getawaySlice,
      heat: 10,
      secretOdds: 0.7,
    };
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'the-job:player-slice',
          payload: JSON.stringify(sliceWithGmFields),
        },
      }),
    );

    expect(received).toHaveLength(1);
    expect(received[0]).not.toHaveProperty('heat');
    expect(received[0]).not.toHaveProperty('secretOdds');
    unsub();
  });

  it('removes the window message listener on unsubscribe', () => {
    const received: PlayerViewSlice[] = [];
    const unsub = subscribeToSlice(s => received.push(s));
    unsub();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-slice', payload: JSON.stringify(idleSlice) },
      }),
    );

    expect(received).toHaveLength(0);
  });
});

// ── subscribeToSlice — window.opener registration ────────────────────────────

describe('subscribeToSlice — opener registration', () => {
  afterEach(() => {
    _clearPlayerWindowsForTesting();
    // Restore window.opener after each test
    Object.defineProperty(window, 'opener', { value: null, writable: true, configurable: true });
  });

  it('posts a registration message to window.opener when opener is set', () => {
    const openerPostMessage = vi.fn();
    Object.defineProperty(window, 'opener', {
      value: { postMessage: openerPostMessage },
      writable: true,
      configurable: true,
    });

    const unsub = subscribeToSlice(() => undefined);
    unsub();

    expect(openerPostMessage).toHaveBeenCalledOnce();
    const [data, origin] = openerPostMessage.mock.calls[0] as [unknown, string];
    expect((data as Record<string, unknown>).type).toBe('the-job:player-ready');
    expect(origin).toBe('*');
  });

  it('does not throw when window.opener is null', () => {
    Object.defineProperty(window, 'opener', { value: null, writable: true, configurable: true });
    expect(() => {
      const unsub = subscribeToSlice(() => undefined);
      unsub();
    }).not.toThrow();
  });
});

// ── publishSlice — postMessage fallback to registered player windows ─────────

describe('publishSlice — postMessage to registered windows', () => {
  afterEach(() => {
    _clearPlayerWindowsForTesting();
  });

  it('sends a postMessage to a window that has registered', () => {
    const mockPostMessage = vi.fn();
    const mockPlayerWindow = { closed: false, postMessage: mockPostMessage } as unknown as Window;

    // Simulate the player window sending its registration message
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-ready' },
        source: mockPlayerWindow,
      }),
    );

    publishSlice(idleSlice);

    expect(mockPostMessage).toHaveBeenCalledOnce();
    const [data, origin] = mockPostMessage.mock.calls[0] as [unknown, string];
    expect((data as Record<string, unknown>).type).toBe('the-job:player-slice');
    expect(origin).toBe('*');
    const payload = JSON.parse(
      (data as Record<string, unknown>).payload as string,
    ) as PlayerViewSlice;
    expect(payload).toEqual(idleSlice);
  });

  it('sends the getaway slice over postMessage with correct payload', () => {
    const mockPostMessage = vi.fn();
    const mockPlayerWindow = { closed: false, postMessage: mockPostMessage } as unknown as Window;

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-ready' },
        source: mockPlayerWindow,
      }),
    );

    publishSlice(getawaySlice);

    const [data] = mockPostMessage.mock.calls[0] as [Record<string, unknown>];
    const payload = JSON.parse(data.payload as string) as PlayerViewSlice;
    expect(payload).toEqual(getawaySlice);
  });

  it('strips GM-only fields before sending via postMessage (isolation)', () => {
    const mockPostMessage = vi.fn();
    const mockPlayerWindow = { closed: false, postMessage: mockPostMessage } as unknown as Window;

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-ready' },
        source: mockPlayerWindow,
      }),
    );

    // Attempt to publish a slice with GM-only extras — Zod strips them
    const sliceWithExtras = { ...getawaySlice, heat: 5, secretMap: 'top-secret' };
    publishSlice(sliceWithExtras as PlayerViewSlice);

    const [data] = mockPostMessage.mock.calls[0] as [Record<string, unknown>];
    const payload = JSON.parse(data.payload as string) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('heat');
    expect(payload).not.toHaveProperty('secretMap');
  });

  it('does not send to a window that has been closed', () => {
    const mockPostMessage = vi.fn();
    const mockPlayerWindow = { closed: true, postMessage: mockPostMessage } as unknown as Window;

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-ready' },
        source: mockPlayerWindow,
      }),
    );

    publishSlice(idleSlice);

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('ignores registration from non-Window sources', () => {
    // MessageEvent with no source (source stays null in jsdom for manual dispatches)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-ready' },
        // source omitted — defaults to null
      }),
    );

    const mockPostMessage = vi.fn();
    // A new registration from a real mock window should still work
    const realWindow = { closed: false, postMessage: mockPostMessage } as unknown as Window;
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'the-job:player-ready' },
        source: realWindow,
      }),
    );

    publishSlice(idleSlice);
    expect(mockPostMessage).toHaveBeenCalledOnce();
  });

  it('does not post to windows with unrelated message types', () => {
    const mockPostMessage = vi.fn();
    const mockPlayerWindow = { closed: false, postMessage: mockPostMessage } as unknown as Window;

    // Unrelated message — should NOT register the window
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'some-other-type' },
        source: mockPlayerWindow,
      }),
    );

    publishSlice(idleSlice);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});

// ── Backward-compatibility: BroadcastChannel path is unchanged ────────────────

describe('subscribeToSlice — BroadcastChannel path (dev/served)', () => {
  it('does not throw when BroadcastChannel is unavailable', () => {
    // In the default jsdom environment BroadcastChannel is not available;
    // the existing try-catch should handle this gracefully.
    expect(() => {
      const unsub = subscribeToSlice(() => undefined);
      unsub();
    }).not.toThrow();
  });
});

describe('publishSlice — BroadcastChannel path (dev/served)', () => {
  it('does not throw when BroadcastChannel is unavailable', () => {
    expect(() => publishSlice(idleSlice)).not.toThrow();
  });

  it('validates the slice with Zod and rejects invalid slices', () => {
    expect(() => publishSlice({ kind: 'unknown' } as unknown as PlayerViewSlice)).toThrow();
  });
});
