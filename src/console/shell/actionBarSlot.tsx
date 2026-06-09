import { createContext, useContext, useState, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface ActionBarSlot {
  left?: ReactNode;
  right?: ReactNode;
  note?: ReactNode;
}

// ── Setter context — stable, ActionBar subscribes here only ───────────────────
// Using two separate contexts prevents ActionBar from re-rendering when the
// slot values change (only CockpitActionBar, which reads the reader context,
// re-renders). This breaks the potential infinite-update loop that would occur
// if ActionBar both wrote and read from the same context.

interface ActionBarSlotSetterContextValue {
  setSlot: (slot: ActionBarSlot) => void;
  clearSlot: () => void;
}

const ActionBarSlotSetterContext =
  createContext<ActionBarSlotSetterContextValue | null>(null);

// ── Reader context — changes on every slot update, CockpitActionBar reads ─────

const ActionBarSlotReaderContext = createContext<ActionBarSlot>({});

// ── Hooks ──────────────────────────────────────────────────────────────────────

const noopSetter: ActionBarSlotSetterContextValue = {
  setSlot: () => { /* no-op outside provider */ },
  clearSlot: () => { /* no-op outside provider */ },
};

export function useActionBarSlotSetter(): ActionBarSlotSetterContextValue {
  return useContext(ActionBarSlotSetterContext) ?? noopSetter;
}

export function useActionBarSlot(): ActionBarSlot {
  return useContext(ActionBarSlotReaderContext);
}

/**
 * Renders the action bar slot contents inline.
 *
 * For use in tests that render a screen component without a full Cockpit —
 * wrap the render with `<ActionBarSlotProvider><ActionBarSlotOutlet />...`
 * so buttons published via <ActionBar> are present in the DOM.
 */
export function ActionBarSlotOutlet() {
  const { left, right, note } = useActionBarSlot();
  return (
    <div data-testid="actionbar-outlet">
      {left}
      {note}
      {right}
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface ActionBarSlotProviderProps {
  children: ReactNode;
}

/**
 * Provides the action-bar slot to the cockpit tree.
 *
 * Stage screens render <ActionBar left right /> and it publishes those nodes
 * here via useActionBarSlotSetter(). CockpitActionBar reads the slot via
 * useActionBarSlot() and renders them in the bottom grid action row.
 *
 * The two-context split (setter vs reader) ensures ActionBar does not
 * re-render when the slot values it published are consumed — the setter
 * context is memoised and never changes, so ActionBar doesn't subscribe to
 * updates and the write→read→write loop never forms.
 */
export function ActionBarSlotProvider({ children }: ActionBarSlotProviderProps) {
  const [slot, setSlotState] = useState<ActionBarSlot>({});

  const setterValue = useMemo<ActionBarSlotSetterContextValue>(
    () => ({
      setSlot: (s: ActionBarSlot) => { setSlotState(s); },
      clearSlot: () => { setSlotState({}); },
    }),
    [],
  );

  return (
    <ActionBarSlotSetterContext.Provider value={setterValue}>
      <ActionBarSlotReaderContext.Provider value={slot}>
        {children}
      </ActionBarSlotReaderContext.Provider>
    </ActionBarSlotSetterContext.Provider>
  );
}
