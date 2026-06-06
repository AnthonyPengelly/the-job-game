/* Typed re-export of CSS variable references for the real design-system tokens.
 * Use these in inline styles or style objects to get token names checked at
 * compile time rather than writing bare var(--…) strings throughout the UI. */

export const tokens = {
  color: {
    bgApp: 'var(--bg-app)',
    bg: 'var(--bg)',
    bgPanel: 'var(--bg-panel)',
    bgPanelRaised: 'var(--bg-panel-raised)',
    bgInput: 'var(--bg-input)',
    fg: 'var(--fg)',
    fgMuted: 'var(--fg-muted)',
    fgFaint: 'var(--fg-faint)',
    accent: 'var(--accent)',
    accentTint: 'var(--accent-tint)',
    danger: 'var(--danger)',
    heat: 'var(--heat)',
    heatGlow: 'var(--heat-glow)',
    data: 'var(--data)',
    border: 'var(--border)',
    borderStrong: 'var(--border-strong)',
  },
  space: {
    1: 'var(--space-1)',
    2: 'var(--space-2)',
    3: 'var(--space-3)',
    4: 'var(--space-4)',
    5: 'var(--space-5)',
    6: 'var(--space-6)',
    7: 'var(--space-7)',
    8: 'var(--space-8)',
    9: 'var(--space-9)',
  },
  radius: {
    xs: 'var(--radius-xs)',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    pill: 'var(--radius-pill)',
  },
  font: {
    display: 'var(--font-display)',
    data: 'var(--font-data)',
    body: 'var(--font-body)',
  },
  glow: {
    accent: 'var(--glow-accent)',
    heat: 'var(--glow-heat)',
    data: 'var(--glow-data)',
  },
  dur: {
    fast: 'var(--dur-fast)',
    base: 'var(--dur-base)',
    slow: 'var(--dur-slow)',
  },
} as const;
