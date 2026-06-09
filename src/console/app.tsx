import { useEffect } from 'react';
import { StoreProvider, useGameStore } from '@/console/store';
import type { CreateGameStoreOptions } from '@/console/store';
import { PhaseRouter, Setup } from '@/console/screens';
import { AudioProvider } from '@/console/audio';
import { Cockpit, CrewRail, ToolRail } from '@/console/shell';
import { CrewRailModeProvider } from '@/console/shell/crewRailMode';
import { ActionBarSlotProvider } from '@/console/shell/actionBarSlot';

// ── App shell ─────────────────────────────────────────────────────────────────

/**
 * The app shell renders the fixed cockpit frame.
 *
 * Routing rules:
 *   - hasResumableSave = true  → Setup (with Resume/New choice)
 *   - crew empty + no save     → Setup (blank new-run form)
 *   - crew non-empty           → PhaseRouter (in-run screens)
 *
 * The CrewRail (E13.2) populates the cockpit left rail.
 * The ToolRail (E13.3) populates the cockpit right rail. ToolRail manages its
 * own overlay state so it renders both the icon buttons and any open overlays
 * (Soundboard drawer, GM Overrides drawer, Settings dialog) as absolutely-
 * positioned children of the cockpit root.
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

  return (
    <Cockpit
      crewRail={crew.length > 0 ? <CrewRail /> : undefined}
      toolRail={<ToolRail />}
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
        <ActionBarSlotProvider>
          <CrewRailModeProvider>
            <AppShell />
          </CrewRailModeProvider>
        </ActionBarSlotProvider>
      </AudioProvider>
    </StoreProvider>
  );
}
