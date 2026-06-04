/* Typed re-export of CSS variable references.
 * Use these in inline styles or style objects to get token names checked at
 * compile time rather than writing bare var(--…) strings throughout the UI. */

export const tokens = {
  color: {
    bg: 'var(--color-bg)',
    surface: 'var(--color-surface)',
    surfaceRaised: 'var(--color-surface-raised)',
    fg: 'var(--color-fg)',
    fgMuted: 'var(--color-fg-muted)',
    accent: 'var(--color-accent)',
    accentMuted: 'var(--color-accent-muted)',
    danger: 'var(--color-danger)',
    dangerMuted: 'var(--color-danger-muted)',
  },
  space: {
    1: 'var(--space-1)',
    2: 'var(--space-2)',
    3: 'var(--space-3)',
    4: 'var(--space-4)',
    6: 'var(--space-6)',
    8: 'var(--space-8)',
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
  },
  font: {
    sans: 'var(--font-sans)',
    mono: 'var(--font-mono)',
    size: {
      sm: 'var(--font-size-sm)',
      base: 'var(--font-size-base)',
      lg: 'var(--font-size-lg)',
      xl: 'var(--font-size-xl)',
      '2xl': 'var(--font-size-2xl)',
    },
  },
} as const;
