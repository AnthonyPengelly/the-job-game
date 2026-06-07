import { useEffect } from 'react';
import { StoreProvider, useGameStore } from '@/console/store';
import type { CreateGameStoreOptions } from '@/console/store';
import { PhaseRouter, Setup } from '@/console/screens';
import { OverridePanel } from '@/console/overrides';
import { DiceModeControl } from '@/console/settings';
import { TuningPanel } from '@/console/tuning';
import { AudioProvider } from '@/console/audio';
import { Soundboard } from '@/console/soundboard';
import { Cockpit, CrewRail } from '@/console/shell';
import { CrewRailModeProvider } from '@/console/shell/crewRailMode';

// ── App shell ─────────────────────────────────────────────────────────────────

/**
 * The app shell renders the fixed cockpit frame.
 *
 * Routing rules:
 *   - hasResumableSave = true  → Setup (with Resume/New choice)
 *   - crew empty + no save     → Setup (blank new-run form)
 *   - crew non-empty           → PhaseRouter (in-run screens)
 *
 * The CrewRail (E13.2) populates the cockpit left rail. It is wrapped in
 * CrewRailModeProvider so stage screens can activate commit / attempter modes
 * (E13.8 will wire the stages). The OverridePanel/Soundboard/settings panels
 * remain as cockpit overlays until E13.3 restructures them into the right rail.
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
      crewRail={crew.length > 0 ? <CrewRail /> : undefined}
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
        <CrewRailModeProvider>
          <AppShell />
        </CrewRailModeProvider>
      </AudioProvider>
    </StoreProvider>
  );
}
