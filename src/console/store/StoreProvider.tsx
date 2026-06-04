import React, { createContext, useContext, useRef } from 'react';
import { useStore } from 'zustand/react';
import type { StoreApi } from 'zustand/vanilla';
import { createGameStore } from './store';
import type { GameStoreState, CreateGameStoreOptions } from './store';
import { loadDefaultConfig } from '@/platform';

// ── Context ───────────────────────────────────────────────────────────────────

export const StoreContext = createContext<StoreApi<GameStoreState> | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface StoreProviderProps {
  children: React.ReactNode;
  /**
   * Override options used when creating the store. Primarily for testing:
   * pass `cfg` + `storage` to inject a test config and in-memory storage.
   * In production the defaults (loadDefaultConfig + window.localStorage) are used.
   */
  options?: Partial<CreateGameStoreOptions>;
}

export function StoreProvider({ children, options }: StoreProviderProps) {
  const storeRef = useRef<StoreApi<GameStoreState> | undefined>(undefined);
  if (storeRef.current === undefined) {
    storeRef.current = createGameStore({
      cfg: options?.cfg ?? loadDefaultConfig(),
      storage: options?.storage ?? window.localStorage,
    });
  }
  return (
    <StoreContext.Provider value={storeRef.current}>
      {children}
    </StoreContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGameStore<T>(selector: (state: GameStoreState) => T): T {
  const store = useContext(StoreContext);
  if (store === null) throw new Error('useGameStore must be used within a StoreProvider');
  return useStore(store, selector);
}
