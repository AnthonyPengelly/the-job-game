import { useEffect } from 'react';
import { StoreProvider, useGameStore } from '@/console/store';
import type { CreateGameStoreOptions } from '@/console/store';
import { PhaseRouter, Setup } from '@/console/screens';
import { Hud } from '@/console/hud';
import { OverridePanel } from '@/console/overrides';
import { DiceModeControl } from '@/console/settings';
import { AudioProvider } from '@/console/audio';
import { Soundboard } from '@/console/soundboard';

// ── App shell ─────────────────────────────────────────────────────────────────

/**
 * The app shell wraps everything in the `.console` design-system shell
 * (sticky HUD, scrolling stage, phase rail). Routing rules:
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
    <div className="console" data-accent="green" data-texture="clean">
      {crew.length > 0 && <Hud />}
      <main className="stage">
        <div className="stage-inner">
          {showSetup ? <Setup /> : <PhaseRouter phase={phase} />}
        </div>
      </main>
      {crew.length > 0 && <OverridePanel />}
      {crew.length > 0 && <Soundboard />}
      {!showSetup && <DiceModeControl />}
    </div>
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
