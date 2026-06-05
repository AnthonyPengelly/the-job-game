import { playerViewSliceSchema } from './slice';
import type { PlayerViewSlice } from './slice';

const CHANNEL_NAME = 'the-job-player-view';

/**
 * Publish a validated PlayerViewSlice to the player-view over a BroadcastChannel.
 * The slice is Zod-parsed before sending — malformed data throws (parse-at-boundary).
 * BroadcastChannel creation is wrapped in try-catch for test/SSR environments.
 */
export function publishSlice(slice: PlayerViewSlice): void {
  const validated = playerViewSliceSchema.parse(slice);
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(JSON.stringify(validated));
    channel.close();
  } catch {
    // BroadcastChannel unavailable (test/SSR environment) — silent no-op
  }
}

/**
 * Subscribe to PlayerViewSlice messages from the console.
 * Parses each received message with Zod; malformed messages are silently discarded.
 * Returns an unsubscribe function.
 */
export function subscribeToSlice(cb: (slice: PlayerViewSlice) => void): () => void {
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
    return () => channel.close();
  } catch {
    // BroadcastChannel unavailable — no-op unsubscribe
    return () => undefined;
  }
}
