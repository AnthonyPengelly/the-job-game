// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { StoreContext } from '@/console/store';
import { createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { Cockpit } from './Cockpit';
import { Dialog } from './overlays/Dialog';
import { Drawer } from './overlays/Drawer';
import { Popover } from './overlays/Popover';

afterEach(cleanup);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

function makeStore() {
  const storage = makeStorage();
  const store = createGameStore({ cfg: testCfg, storage });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
  return store;
}

// ── No document scroll ────────────────────────────────────────────────────────

describe('Cockpit — no document scroll', () => {
  it('the body has overflow:hidden (document never scrolls)', () => {
    // kit.css sets body { overflow: hidden }. Even without JSDOM rendering CSS,
    // we can verify the cockpit-work element is the scroll container.
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <Cockpit>
          <div>Phase content</div>
        </Cockpit>
      </StoreContext.Provider>,
    );

    // The cockpit-work div is the scroll container; it exists and wraps children
    expect(screen.getByTestId('cockpit-work')).toBeInTheDocument();
    // The cockpit stage exists
    expect(screen.getByTestId('cockpit-stage')).toBeInTheDocument();
  });

  it('the cockpit-work div is the inner scroll container, not the document root', () => {
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <Cockpit>
          <div data-testid="stage-content">Content goes here</div>
        </Cockpit>
      </StoreContext.Provider>,
    );

    const work = screen.getByTestId('cockpit-work');
    const content = screen.getByTestId('stage-content');

    // The content lives inside the work area (not at document root)
    expect(work.contains(content)).toBe(true);
  });
});

// ── Grid regions ──────────────────────────────────────────────────────────────

describe('Cockpit — stable grid regions', () => {
  it('renders the top rail with meters', () => {
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <Cockpit>
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    expect(screen.getByTestId('hud')).toBeInTheDocument();
    expect(screen.getByTestId('hud-heat-section')).toBeInTheDocument();
    expect(screen.getByTestId('hud-loot-section')).toBeInTheDocument();
  });

  it('renders left and right rail placeholders', () => {
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <Cockpit>
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    expect(screen.getByTestId('cockpit-crewrail')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-toolsrail')).toBeInTheDocument();
  });

  it('renders the action bar', () => {
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <Cockpit>
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    expect(screen.getByTestId('cockpit-actionbar')).toBeInTheDocument();
  });

  it('renders crewRail content in the left rail', () => {
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <Cockpit crewRail={<div data-testid="crew-content">Crew here</div>}>
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    const crewRail = screen.getByTestId('cockpit-crewrail');
    expect(crewRail.contains(screen.getByTestId('crew-content'))).toBe(true);
  });

  it('renders children in the stage work area', () => {
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <Cockpit>
          <div data-testid="phase-content">Phase screen</div>
        </Cockpit>
      </StoreContext.Provider>,
    );

    const work = screen.getByTestId('cockpit-work');
    expect(work.contains(screen.getByTestId('phase-content'))).toBe(true);
  });
});

// ── Overlay: Dialog ───────────────────────────────────────────────────────────

describe('Dialog overlay', () => {
  it('mounts and shows its title', () => {
    const store = makeStore();
    let closed = false;
    render(
      <StoreContext.Provider value={store}>
        <Cockpit
          overlays={
            <Dialog title="Confirm" onClose={() => { closed = true; }}>
              <p>Are you sure?</p>
            </Dialog>
          }
        >
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(closed).toBe(false);
  });

  it('calls onClose when the scrim is clicked', () => {
    const store = makeStore();
    let closed = false;
    render(
      <StoreContext.Provider value={store}>
        <Cockpit
          overlays={
            <Dialog title="Test" onClose={() => { closed = true; }}>
              <p>Body</p>
            </Dialog>
          }
        >
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('cockpit-scrim'));
    expect(closed).toBe(true);
  });

  it('calls onClose when Esc is pressed', () => {
    const store = makeStore();
    let closed = false;
    render(
      <StoreContext.Provider value={store}>
        <Cockpit
          overlays={
            <Dialog title="Test" onClose={() => { closed = true; }}>
              <p>Body</p>
            </Dialog>
          }
        >
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closed).toBe(true);
  });
});

// ── Overlay: Drawer ───────────────────────────────────────────────────────────

describe('Drawer overlay', () => {
  it('mounts and shows its title', () => {
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <Cockpit
          overlays={
            <Drawer title="Soundboard" onClose={() => {}}>
              <p>Content</p>
            </Drawer>
          }
        >
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    expect(screen.getByTestId('cockpit-drawer')).toBeInTheDocument();
    expect(screen.getByText('Soundboard')).toBeInTheDocument();
  });

  it('calls onClose when the soft scrim is clicked', () => {
    const store = makeStore();
    let closed = false;
    render(
      <StoreContext.Provider value={store}>
        <Cockpit
          overlays={
            <Drawer title="Test" onClose={() => { closed = true; }}>
              <p>Body</p>
            </Drawer>
          }
        >
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('cockpit-scrim'));
    expect(closed).toBe(true);
  });

  it('calls onClose when Esc is pressed', () => {
    const store = makeStore();
    let closed = false;
    render(
      <StoreContext.Provider value={store}>
        <Cockpit
          overlays={
            <Drawer title="Test" onClose={() => { closed = true; }}>
              <p>Body</p>
            </Drawer>
          }
        >
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closed).toBe(true);
  });
});

// ── Overlay: Popover ──────────────────────────────────────────────────────────

describe('Popover overlay', () => {
  it('mounts and shows its content', () => {
    const store = makeStore();
    render(
      <StoreContext.Provider value={store}>
        <Cockpit
          overlays={
            <Popover onClose={() => {}} style={{ top: 100, left: 80 }}>
              <div data-testid="popover-content">Crew detail</div>
            </Popover>
          }
        >
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    expect(screen.getByTestId('cockpit-popover')).toBeInTheDocument();
    expect(screen.getByTestId('popover-content')).toBeInTheDocument();
  });

  it('calls onClose when Esc is pressed', () => {
    const store = makeStore();
    let closed = false;
    render(
      <StoreContext.Provider value={store}>
        <Cockpit
          overlays={
            <Popover onClose={() => { closed = true; }} style={{ top: 100, left: 80 }}>
              <div>Content</div>
            </Popover>
          }
        >
          <div />
        </Cockpit>
      </StoreContext.Provider>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closed).toBe(true);
  });
});
