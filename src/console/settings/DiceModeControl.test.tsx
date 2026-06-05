// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DiceModeControl } from './DiceModeControl';
import { StoreProvider } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import { SETTINGS_VERSION } from '@/content/schema/settings';

// ── In-memory storage stub ────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

function renderWithStore(storage: StorageLike) {
  return render(
    <StoreProvider options={{ cfg: testCfg, storage }}>
      <DiceModeControl />
    </StoreProvider>,
  );
}

afterEach(() => { cleanup(); });

// ── Default state ─────────────────────────────────────────────────────────────

describe('DiceModeControl default', () => {
  it('shows "App roll" as the default selected value', () => {
    const storage = makeStorage();
    renderWithStore(storage);
    const select = screen.getByTestId('dice-mode-select') as HTMLSelectElement;
    expect(select.value).toBe('app');
  });
});

// ── Toggle ────────────────────────────────────────────────────────────────────

describe('DiceModeControl toggle', () => {
  it('switches to physical when the user selects Physical roll', () => {
    const storage = makeStorage();
    renderWithStore(storage);
    const select = screen.getByTestId('dice-mode-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'physical' } });
    expect(select.value).toBe('physical');
  });

  it('writes through to settings storage when toggled', () => {
    const storage = makeStorage();
    renderWithStore(storage);
    const select = screen.getByTestId('dice-mode-select');
    fireEvent.change(select, { target: { value: 'physical' } });
    const raw = storage.getItem('the-job:settings');
    expect(raw).not.toBeNull();
    const written = JSON.parse(raw!) as { diceMode: string };
    expect(written.diceMode).toBe('physical');
  });

  it('toggles back to app from physical', () => {
    const storage = makeStorage();
    // Pre-seed storage with physical
    storage.setItem('the-job:settings', JSON.stringify({ version: SETTINGS_VERSION, diceMode: 'physical' }));
    renderWithStore(storage);
    const select = screen.getByTestId('dice-mode-select') as HTMLSelectElement;
    expect(select.value).toBe('physical');
    fireEvent.change(select, { target: { value: 'app' } });
    expect(select.value).toBe('app');
  });
});

// ── Reload / rehydration ──────────────────────────────────────────────────────

describe('DiceModeControl reload survival', () => {
  it('renders physical mode when storage already holds physical', () => {
    const storage = makeStorage();
    storage.setItem(
      'the-job:settings',
      JSON.stringify({ version: SETTINGS_VERSION, diceMode: 'physical' }),
    );
    renderWithStore(storage);
    const select = screen.getByTestId('dice-mode-select') as HTMLSelectElement;
    expect(select.value).toBe('physical');
  });
});
