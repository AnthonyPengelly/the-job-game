import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { initialState, initialSession, reduceSession } from '@/engine';
import type { EngineConfig, RunEvent, PlayerSetup, SessionState } from '@/engine';
import {
  writeSave,
  readSave,
  clearSave,
  readSettings,
  writeSettings,
  readLeaderboard,
  appendScore,
  topEntries,
} from '@/platform';
import type { StorageLike } from '@/platform';
import { SAVE_VERSION } from '@/content/schema/save';
import { SETTINGS_VERSION } from '@/content/schema/settings';
import type { DiceMode } from '@/content/schema/settings';
import type { ParsedNarration } from '@/content/schema';
import type { LeaderboardEntry } from '@/content/schema/leaderboard';
import { createNarrationDirector } from '@/console/teleprompter';
import type { NarrationDirector } from '@/console/teleprompter';
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
  /** Whether the app rolls the d20 automatically or the GM enters a physical die result. */
  diceMode: DiceMode;
  /**
   * Narration director seeded from `runSeed`. Null when no narration bank was
   * provided to the store (e.g. in engine-only tests). Recreated on every
   * startRun / hydrate / goAgain so narration deterministically follows runSeed.
   */
  director: NarrationDirector | null;

  /** All leaderboard entries sorted by score descending. Refreshed on every write. */
  leaderboard: LeaderboardEntry[];
  /**
   * 1-indexed rank of the current run in the leaderboard. Set when a dispatch
   * transitions to the result phase with a final score; reset to null otherwise.
   */
  currentRunRank: number | null;
  /**
   * True if the current run's score is a new personal best for this seed.
   * Set alongside currentRunRank; reset to false when leaving the result phase.
   */
  currentRunNewBest: boolean;

  // Actions
  dispatch: (event: RunEvent) => void;
  undo: () => void;
  startRun: (setup: PlayerSetup[], seed?: number) => void;
  goAgain: () => void;
  hydrate: () => void;
  /**
   * Acknowledge the resumable-save prompt: clears `hasResumableSave` so the
   * app routes to the active phase screen instead of the Setup screen.
   * Call when the GM chooses "Resume the job".
   */
  acceptResume: () => void;
  /** Toggle dice mode and write through to settings storage. GM-only. */
  setDiceMode: (mode: DiceMode) => void;
}

// ── Factory options ───────────────────────────────────────────────────────────

export interface CreateGameStoreOptions {
  cfg: EngineConfig;
  storage: StorageLike;
  /** Optional narration bank. When supplied the store creates and seeds a
   *  NarrationDirector on every run start / hydrate / goAgain. */
  narration?: ParsedNarration;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createGameStore(options: CreateGameStoreOptions): StoreApi<GameStoreState> {
  const { cfg, storage, narration } = options;

  function makeDirector(seed: number): NarrationDirector | null {
    if (!narration) return null;
    return createNarrationDirector(narration, seed);
  }

  function writeThrough(seed: number, eventLog: RunEvent[]): void {
    writeSave({ version: SAVE_VERSION, seed, eventLog }, storage);
  }

  function sortedLeaderboard(): LeaderboardEntry[] {
    return topEntries(Number.MAX_SAFE_INTEGER, storage);
  }

  // Read settings at store-creation time so diceMode is available before the
  // first hydrate() call (e.g. on the Setup screen before a run starts).
  const initialSettings = readSettings(storage);

  return createStore<GameStoreState>()((set, get) => ({
    session: initialSession(initialState(0)),
    eventLog: [],
    cfg,
    runSeed: 0,
    hasResumableSave: false,
    staleSaveNotice: false,
    diceMode: initialSettings.diceMode,
    director: makeDirector(0),
    leaderboard: sortedLeaderboard(),
    currentRunRank: null,
    currentRunNewBest: false,

    dispatch(event: RunEvent): void {
      const { session, eventLog, cfg: c, runSeed } = get();
      const newSession = reduceSession(session, event, c);
      const newLog = [...eventLog, event];
      writeThrough(runSeed, newLog);

      // Write to leaderboard when a dispatch lands us in the result phase.
      // Dedupe by runSeed (upsert keeping best score) so undo/redo across the
      // result boundary never double-counts.
      let leaderboardPatch: Partial<Pick<GameStoreState, 'leaderboard' | 'currentRunRank' | 'currentRunNewBest'>> = {};
      if (newSession.present.phase === 'result' && newSession.present.finalScore !== undefined) {
        const prevBestForSeed = readLeaderboard(storage).entries.find(
          e => e.runSeed === runSeed,
        );
        const entry: LeaderboardEntry = {
          runSeed,
          score: newSession.present.finalScore,
          loot: newSession.present.loot,
          heatAtGetaway: newSession.present.heat,
          win: newSession.present.win ?? false,
          crewSize: newSession.present.crew.length,
          finishedAt: Date.now(),
        };
        const newEnvelope = appendScore(entry, storage);
        const sorted = [...newEnvelope.entries].sort((a, b) => b.score - a.score);
        const rank = sorted.findIndex(e => e.runSeed === runSeed) + 1;
        const currentRunNewBest =
          prevBestForSeed === undefined || entry.score > prevBestForSeed.score;
        leaderboardPatch = {
          leaderboard: sorted,
          currentRunRank: rank > 0 ? rank : null,
          currentRunNewBest,
        };
      } else if (session.present.phase === 'result' && newSession.present.phase !== 'result') {
        // Undo out of result phase — rank/new-best are no longer valid.
        leaderboardPatch = { currentRunRank: null, currentRunNewBest: false };
      }

      set({ session: newSession, eventLog: newLog, ...leaderboardPatch });
    },

    undo(): void {
      const { session, eventLog, cfg: c, runSeed } = get();
      if (eventLog.length === 0) return;
      const newSession = reduceSession(session, { t: 'UNDO_LAST' }, c);
      const newLog = eventLog.slice(0, -1);
      writeThrough(runSeed, newLog);

      // Clear rank/new-best if we've undone out of the result phase.
      const leavingResult =
        session.present.phase === 'result' && newSession.present.phase !== 'result';
      const leaderboardPatch = leavingResult
        ? { currentRunRank: null, currentRunNewBest: false }
        : {};

      set({ session: newSession, eventLog: newLog, ...leaderboardPatch });
    },

    startRun(setup: PlayerSetup[], seed?: number): void {
      const { cfg: c } = get();
      const startSeed = (seed ?? 0) >>> 0;
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
        staleSaveNotice: false,
        director: makeDirector(startSeed),
        currentRunRank: null,
        currentRunNewBest: false,
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
        director: makeDirector(0),
        currentRunRank: null,
        currentRunNewBest: false,
      });
    },

    acceptResume(): void {
      set({ hasResumableSave: false });
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
          director: makeDirector(result.save.seed),
          // Hydrate/replay does not append to the leaderboard.
          // Refresh the leaderboard read so any externally-modified storage is
          // picked up, but do not write a new entry.
          leaderboard: sortedLeaderboard(),
          currentRunRank: null,
          currentRunNewBest: false,
        });
      } else if (result.reason === 'stale' || result.reason === 'corrupt') {
        clearSave(storage);
        set({ staleSaveNotice: true });
      }
      // 'absent': clean start — no notice, nothing to clear

      // Always re-read settings on hydrate so a manual storage edit is picked up.
      const settings = readSettings(storage);
      set({ diceMode: settings.diceMode });
    },

    setDiceMode(mode: DiceMode): void {
      writeSettings({ version: SETTINGS_VERSION, diceMode: mode }, storage);
      set({ diceMode: mode });
    },
  }));
}
