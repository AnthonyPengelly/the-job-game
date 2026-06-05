import { useEffect } from 'react';
import { StoreProvider, useGameStore } from '@/console/store';
import type { CreateGameStoreOptions } from '@/console/store';
import { PhaseRouter, Setup } from '@/console/screens';
import { Hud } from '@/console/hud';

// ── App shell ─────────────────────────────────────────────────────────────────

/**
 * The app shell reads from the store and decides whether to show the pre-run
 * Setup screen or route to the correct in-run screen via PhaseRouter.
 *
 * Routing rules:
 *   - hasResumableSave = true  → Setup (with Resume/New choice)
 *   - crew empty + no save     → Setup (blank new-run form)
 *   - crew non-empty           → PhaseRouter (in-run screens)
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
    <>
      {crew.length > 0 && <Hud />}
      {showSetup ? <Setup /> : <PhaseRouter phase={phase} />}
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

/**
 * App root. Accepts optional store injection for testing (via `storeOptions`).
 */
interface AppProps {
  storeOptions?: Partial<CreateGameStoreOptions>;
}

export function App({ storeOptions }: AppProps) {
  const providerProps = storeOptions !== undefined ? { options: storeOptions } : {};
  return (
    <StoreProvider {...providerProps}>
      <AppShell />
    </StoreProvider>
  );
}
