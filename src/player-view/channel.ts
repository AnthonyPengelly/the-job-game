// Player-view side of the channel — receives the read-only PlayerViewSlice.
// Imports only from @/platform (never @/console).
export { subscribeToSlice } from '@/platform/channel';
export type { PlayerViewSlice, DefuseRulebookSlice } from '@/platform/channel';
