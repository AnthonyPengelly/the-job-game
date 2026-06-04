import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { initialState, initialSession, reduceSession } from '@/engine';
import type { EngineConfig, RunEvent, PlayerSetup, SessionState } from '@/engine';
import { writeSave, readSave, clearSave } from '@/platform';
import type { StorageLike } from '@/platform';
import { SAVE_VERSION } from '@/content/schema/save';
import { replay } from './replay';

// ── State shape ───────────────────────────────────────────────────────────────

export interface GameStoreState {
  session: SessionState;
  eventLog: RunEvent[];
  cfg: EngineConfig;
  /** The seed of the current run — used as the save envelope seed. */
  runSeed: number;
  /** True after a successful hydrate: the store has resumed a prior run. */
  hasResumableSave: boolean;
  /**
   * True when hydrate found a stale or corrupt save. The UI should surface a
   * one-time notice to the GM before clearing it.
   */
  staleSaveNotice: boolean;

  // Actions
  dispatch: (event: RunEvent) => void;
  undo: () => void;
  startRun: (setup: PlayerSetup[], seed?: number) => void;
  goAgain: () => void;
  hydrate: () => void;
}

// ── Factory options ───────────────────────────────────────────────────────────

export interface CreateGameStoreOptions {
  cfg: EngineConfig;
  storage: StorageLike;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createGameStore(options: CreateGameStoreOptions): StoreApi<GameStoreState> {
  const { cfg, storage } = options;

  function writeThrough(seed: number, eventLog: RunEvent[]): void {
    writeSave({ version: SAVE_VERSION, seed, eventLog }, storage);
  }

  return createStore<GameStoreState>()((set, get) => ({
    session: initialSession(initialState(0)),
    eventLog: [],
    cfg,
    runSeed: 0,
    hasResumableSave: false,
    staleSaveNotice: false,

    dispatch(event: RunEvent): void {
      const { session, eventLog, cfg: c, runSeed } = get();
      const newSession = reduceSession(session, event, c);
      const newLog = [...eventLog, event];
      writeThrough(runSeed, newLog);
      set({ session: newSession, eventLog: newLog });
    },

    undo(): void {
      const { session, eventLog, cfg: c, runSeed } = get();
      const newSession = reduceSession(session, { t: 'UNDO_LAST' }, c);
      const newLog = eventLog.length > 0 ? eventLog.slice(0, -1) : [];
      writeThrough(runSeed, newLog);
      set({ session: newSession, eventLog: newLog });
    },

    startRun(setup: PlayerSetup[], seed?: number): void {
      const { cfg: c } = get();
      const startSeed = (seed !== undefined ? seed : 0) >>> 0;
      const startEvent: RunEvent = { t: 'START_RUN', crew: setup, seed: startSeed };
      const baseSession = initialSession(initialState(startSeed));
      const newSession = reduceSession(baseSession, startEvent, c);
      const newLog: RunEvent[] = [startEvent];
      writeThrough(startSeed, newLog);
      set({
        session: newSession,
        eventLog: newLog,
        runSeed: startSeed,
        hasResumableSave: false,
      });
    },

    goAgain(): void {
      clearSave(storage);
      set({
        session: initialSession(initialState(0)),
        eventLog: [],
        runSeed: 0,
        hasResumableSave: false,
        staleSaveNotice: false,
      });
    },

    hydrate(): void {
      const { cfg: c } = get();
      const result = readSave(storage);
      if (result.ok) {
        const replayed = replay(result.save.seed, result.save.eventLog, c);
        set({
          session: replayed,
          eventLog: result.save.eventLog,
          runSeed: result.save.seed,
          hasResumableSave: true,
        });
      } else if (result.reason === 'stale' || result.reason === 'corrupt') {
        clearSave(storage);
        set({ staleSaveNotice: true });
      }
      // 'absent': clean start — no notice, nothing to clear
    },
  }));
}
