import React, { createContext, useContext, useRef } from 'react';
import { useStore } from 'zustand/react';
import type { StoreApi } from 'zustand/vanilla';
import { createGameStore } from './store';
import type { GameStoreState, CreateGameStoreOptions } from './store';
import {
  loadDefaultConfig,
  loadDefaultNarration,
  buildConfigFromPreset,
  readSettings,
} from '@/platform';
import type { StorageLike } from '@/platform';

// ── Context ───────────────────────────────────────────────────────────────────

export const StoreContext = createContext<StoreApi<GameStoreState> | null>(null);

// ── Boot-time preset resolution ───────────────────────────────────────────────

export interface BootPreset {
  cfg: ReturnType<typeof loadDefaultConfig>;
  activePresetId: string;
  presetFallbackNotice: boolean;
}

/**
 * Resolve the active preset at boot.
 * Priority: searchString ?preset= param → persisted activePresetId setting → 'default'.
 * Falls back to 'default' + sets presetFallbackNotice when the resolved preset
 * is missing or invalid (docs/CONTENT-AND-TUNING.md §3).
 *
 * @param storage - the storage to read settings and presets from
 * @param searchString - the URL search string (window.location.search in browser,
 *   injectable for tests)
 */
export function resolveBootPreset(
  storage: StorageLike,
  searchString?: string,
): BootPreset {
  const search = searchString ?? (typeof window !== 'undefined' ? window.location.search : '');
  const urlParam = new URLSearchParams(search).get('preset');
  const settings = readSettings(storage);
  const candidateId = urlParam ?? settings.activePresetId;

  if (candidateId !== 'default') {
    const result = buildConfigFromPreset(candidateId, storage);
    if (result.ok) {
      return { cfg: result.cfg, activePresetId: candidateId, presetFallbackNotice: false };
    }
    console.warn(
      `[the-job] boot: preset "${candidateId}" invalid or missing — falling back to default`,
    );
    return { cfg: loadDefaultConfig(), activePresetId: 'default', presetFallbackNotice: true };
  }
  return { cfg: loadDefaultConfig(), activePresetId: 'default', presetFallbackNotice: false };
}

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
    const storage = options?.storage ?? window.localStorage;
    // When a test/caller injects cfg directly, skip preset resolution and use
    // it as-is; otherwise resolve from URL param / settings / 'default'.
    const boot: BootPreset = options?.cfg
      ? {
          cfg: options.cfg,
          activePresetId: options.activePresetId ?? 'default',
          presetFallbackNotice: options.presetFallbackNotice ?? false,
        }
      : resolveBootPreset(storage);
    storeRef.current = createGameStore({
      ...boot,
      storage,
      narration: options?.narration ?? loadDefaultNarration(),
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
