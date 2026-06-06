import { playerViewSliceSchema } from './slice';
import type { PlayerViewSlice } from './slice';

const CHANNEL_NAME = 'the-job-player-view';
const MESSAGE_TYPE = 'the-job:player-slice';
const REGISTER_TYPE = 'the-job:player-ready';

// Console-side registry: player windows that have announced themselves.
// postMessage to these windows is the file://-safe fallback transport.
const playerWindows = new Set<Window>();

// Set up the console-side registration listener at module load time.
// Both the console and player-view windows import this module; only the
// console window will ever receive REGISTER_TYPE messages (from its opened
// player windows), so this listener is a no-op in the player-view context.
try {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as Record<string, unknown> | null;
    if (
      data !== null &&
      typeof data === 'object' &&
      data.type === REGISTER_TYPE &&
      event.source !== null &&
      typeof event.source === 'object' &&
      typeof (event.source as unknown as Record<string, unknown>).postMessage === 'function'
    ) {
      playerWindows.add(event.source as unknown as Window);
    }
  });
} catch {
  // Not in a browser context (node test environment) — no-op
}

/**
 * Publish a validated PlayerViewSlice to the player-view.
 *
 * Primary transport: BroadcastChannel — works in served/dev contexts.
 * Fallback transport: window.postMessage to any player windows that have
 * registered themselves — works under file:// where BroadcastChannel is
 * unreliable across opaque/divergent origins.
 */
export function publishSlice(slice: PlayerViewSlice): void {
  const validated = playerViewSliceSchema.parse(slice);
  const payload = JSON.stringify(validated);

  // BroadcastChannel (served/dev)
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(payload);
    channel.close();
  } catch {
    // BroadcastChannel unavailable (test/SSR environment) — silent no-op
  }

  // postMessage fallback (file://)
  for (const win of [...playerWindows]) {
    if (win.closed) {
      playerWindows.delete(win);
      continue;
    }
    try {
      win.postMessage({ type: MESSAGE_TYPE, payload }, '*');
    } catch {
      playerWindows.delete(win);
    }
  }
}

/**
 * Subscribe to PlayerViewSlice messages from the console.
 *
 * Listens on both BroadcastChannel (served/dev) and window message events
 * (file:// fallback). Parses every incoming message with Zod — malformed
 * messages are silently discarded. If window.opener is available the
 * player-view announces itself so the console can route postMessage slices
 * back to this window.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToSlice(cb: (slice: PlayerViewSlice) => void): () => void {
  const cleanups: Array<() => void> = [];

  // BroadcastChannel (served/dev)
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      try {
        const parsed = playerViewSliceSchema.parse(JSON.parse(event.data as string));
        cb(parsed);
      } catch {
        // Malformed or invalid slice — discard silently
      }
    };
    cleanups.push(() => channel.close());
  } catch {
    // BroadcastChannel unavailable — no-op
  }

  // window.postMessage fallback (file://)
  try {
    const handler = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (data === null || typeof data !== 'object' || data.type !== MESSAGE_TYPE) return;
      try {
        const parsed = playerViewSliceSchema.parse(JSON.parse(data.payload as string));
        cb(parsed);
      } catch {
        // Malformed or invalid slice — discard silently
      }
    };
    window.addEventListener('message', handler);
    cleanups.push(() => window.removeEventListener('message', handler));

    // Announce this player window to the console so it can route slices back.
    // window.opener is set when the player window was opened from the console
    // (e.g. via window.open) and is null when opened independently.
    if (window.opener) {
      (window.opener as Window).postMessage({ type: REGISTER_TYPE }, '*');
    }
  } catch {
    // Not in a real browser context — no-op
  }

  return () => cleanups.forEach(fn => fn());
}

/** @internal — for test isolation only; clears the player-window registry. */
export function _clearPlayerWindowsForTesting(): void {
  playerWindows.clear();
}
