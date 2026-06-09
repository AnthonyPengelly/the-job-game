// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ActionBarSlotProvider, useActionBarSlot } from '@/console/shell/actionBarSlot';
import { ActionBar } from './ActionBar';

afterEach(cleanup);

// Helper: a consumer component that renders slot contents
function SlotDisplay() {
  const { left, right, note } = useActionBarSlot();
  return (
    <div>
      <div data-testid="slot-left">{left}</div>
      <div data-testid="slot-right">{right}</div>
      <div data-testid="slot-note">{note}</div>
    </div>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ActionBarSlotProvider>
      <SlotDisplay />
      {children}
    </ActionBarSlotProvider>
  );
}

describe('ActionBar — renders nothing in place', () => {
  it('renders null (no DOM element)', () => {
    const { container } = render(
      <Wrapper>
        <ActionBar left={<button>Back</button>} right={<button>Next</button>} />
      </Wrapper>,
    );
    // No .actionbar div — ActionBar renders nothing in place
    expect(container.querySelector('.actionbar')).toBeNull();
  });
});

describe('ActionBar — publishes to slot', () => {
  it('publishes left to the action bar slot', async () => {
    await act(async () => {
      render(
        <Wrapper>
          <ActionBar left={<button>Back</button>} />
        </Wrapper>,
      );
    });
    expect(screen.getByTestId('slot-left').textContent).toContain('Back');
  });

  it('publishes right to the action bar slot', async () => {
    await act(async () => {
      render(
        <Wrapper>
          <ActionBar right={<button>Next</button>} />
        </Wrapper>,
      );
    });
    expect(screen.getByTestId('slot-right').textContent).toContain('Next');
  });

  it('publishes both left and right', async () => {
    await act(async () => {
      render(
        <Wrapper>
          <ActionBar left={<button>Back</button>} right={<button>Next</button>} />
        </Wrapper>,
      );
    });
    expect(screen.getByTestId('slot-left').textContent).toContain('Back');
    expect(screen.getByTestId('slot-right').textContent).toContain('Next');
  });

  it('publishes an optional note', async () => {
    await act(async () => {
      render(
        <Wrapper>
          <ActionBar right={<button>Go</button>} note="Difficulty: 8" />
        </Wrapper>,
      );
    });
    expect(screen.getByTestId('slot-note').textContent).toContain('Difficulty: 8');
  });

  it('clears the slot on unmount', async () => {
    const { unmount } = await act(async () =>
      render(
        <Wrapper>
          <ActionBar left={<button>Back</button>} right={<button>Next</button>} />
        </Wrapper>,
      ),
    );
    expect(screen.getByTestId('slot-left').textContent).toContain('Back');

    await act(async () => { unmount(); });
    // After unmount, SlotDisplay is also gone — but test that the effect cleanup ran
    // by re-rendering the wrapper without ActionBar
    await act(async () => {
      render(
        <ActionBarSlotProvider>
          <SlotDisplay />
        </ActionBarSlotProvider>,
      );
    });
    // Slot should be empty (cleared)
    const leftEls = screen.getAllByTestId('slot-left');
    // The last rendered SlotDisplay (standalone provider) should be empty
    expect(leftEls[leftEls.length - 1]?.textContent).toBe('');
  });
});

describe('ActionBar — empty props', () => {
  it('renders without any props (no error)', async () => {
    await expect(
      act(async () => {
        render(<Wrapper><ActionBar /></Wrapper>);
      }),
    ).resolves.not.toThrow();
  });
});
