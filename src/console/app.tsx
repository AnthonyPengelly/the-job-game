import { useEffect } from 'react';
import { StoreProvider, useGameStore } from '@/console/store';
import type { CreateGameStoreOptions } from '@/console/store';
import { PhaseRouter, Setup } from '@/console/screens';
import { Hud } from '@/console/hud';
import { OverridePanel } from '@/console/overrides';
import { DiceModeControl } from '@/console/settings';
import { TuningPanel } from '@/console/tuning';
import { AudioProvider } from '@/console/audio';
import { Soundboard } from '@/console/soundboard';
import { Cockpit } from '@/console/shell';

// ── App shell ─────────────────────────────────────────────────────────────────

/**
 * The app shell renders the fixed cockpit frame.
 *
 * Routing rules:
 *   - hasResumableSave = true  → Setup (with Resume/New choice)
 *   - crew empty + no save     → Setup (blank new-run form)
 *   - crew non-empty           → PhaseRouter (in-run screens)
 *
 * The Hud component (crew content) is mounted in the cockpit left rail
 * until E13.2 replaces it with the proper CrewRail. The existing
 * OverridePanel/Soundboard/settings panels remain as cockpit overlays
 * until E13.3 restructures them into the right rail.
 */
function AppShell() {
  const hydrate = useGameStore(s => s.hydrate);
  const crew = useGameStore(s => s.session.present.crew);
  const phase = useGameStore(s => s.session.present.phase);
  const hasResumableSave = useGameStore(s => s.hasResumableSave);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSetup = hasResumableSave || crew.length === 0;

  const overlays = crew.length > 0 ? (
    <>
      <OverridePanel />
      <Soundboard />
      {!showSetup && <DiceModeControl />}
      {!showSetup && <TuningPanel />}
    </>
  ) : null;

  return (
    <Cockpit
      crewRail={crew.length > 0 ? <Hud /> : undefined}
      overlays={overlays}
    >
      {showSetup ? <Setup /> : <PhaseRouter phase={phase} />}
    </Cockpit>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

interface AppProps {
  storeOptions?: Partial<CreateGameStoreOptions>;
}

export function App({ storeOptions }: AppProps) {
  const providerProps = storeOptions !== undefined ? { options: storeOptions } : {};
  return (
    <StoreProvider {...providerProps}>
      <AudioProvider>
        <AppShell />
      </AudioProvider>
    </StoreProvider>
  );
}
