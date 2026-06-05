# DESIGN-SYSTEM.md — The Job

A completed design system for The Job lives in `design-system/` at the repo root. It is the **source of truth for all visual decisions** — tokens, type, spacing, components, iconography, and content voice. Do not invent new tokens, override the colour palette, or add alternative type faces without a design review.

## What's in it

| File / Folder | What |
|---|---|
| `design-system/README.md` | Full design philosophy, visual foundations, content voice rules, iconography |
| `design-system/colors_and_type.css` | **The token file.** All CSS custom properties: colour, type, spacing, radius, elevation, motion, semantic type classes. This is the one file every component builds on. |
| `design-system/SKILL.md` | Agent-skills entry point for throwaway prototypes and design exploration |
| `design-system/preview/` | Specimen cards for every token and named component — verify your implementation against these |
| `design-system/ui_kits/gm-console/` | High-fidelity GM Console components: `App.jsx`, `Hud.jsx`, `PhaseScreens.jsx`, `Primitives.jsx`, `tweaks-panel.jsx`, `kit.css` |
| `design-system/ui_kits/player-view/` | Player View components: `PlayerView.jsx`, `player.css` |
| `design-system/assets/` | Brand assets |

The UI kits are illustrative JSX (no build system, no TypeScript) — translate their patterns into your typed React component tree rather than copying verbatim.

---

## Implementation: what happens in which epic

### E0 — wire the tokens (scaffold, not a placeholder)

1. Copy `design-system/colors_and_type.css` into `src/console/theme/tokens.css` and import it at the app root (`main.tsx`). Do not modify token values — if a value needs changing, raise a design question first.
2. Self-host the three Google Fonts as woff2 under `public/fonts/`: **Saira Condensed** (500/600/700/800), **JetBrains Mono** (400/500/700/800), **IBM Plex Sans** (400/500/600/700 + italic 400). Replace the `@import url(...)` line at the top of `tokens.css` with local `@font-face` blocks pointing into `public/fonts/`. The app is offline — CDN calls will silently fail at the table.
3. Add a build check that no CDN hostname appears in the final CSS bundle (`fonts.googleapis.com`, `cdn.jsdelivr.net`).

### E10 — full visual pass

Apply the UI kits to every surface. Reference checklist:

**GM Console**
- HUD: sticky top bar with Heat track (20 slots), Loot counter, crew panel — match `design-system/ui_kits/gm-console/Hud.jsx` layout and `kit.css`.
- Phase screens: Setup → Briefing → Obstacle → Scenario → Offer → Getaway → Result — match `PhaseScreens.jsx`.
- Shared primitives (phase tag, action bar, override panel, panel card) — match `Primitives.jsx` and `tweaks-panel.jsx`.
- Heat track: 20 slots, face-down-card fill animation at `--dur-slow`, `--glow-heat` ring on the live slot.
- Teleprompter block: `--accent-tint` background wash, 3px green left-rule, `t-teleprompter` type class (`--leading-relax`, `--c-green-200` text).
- Phase transitions: `--dur-slow` fade/slide; no decorative animation loops.
- Iconography: Lucide stroke icons, `stroke-width: 1.75`, tinted by semantic token, always paired with a mono-caps label. Icons are **bundled** (import from `lucide-react`) — never loaded from CDN at runtime.

**Player View**
- Implement from `design-system/ui_kits/player-view/PlayerView.jsx` and `player.css`.
- No GM chrome, no Heat internals — isolated surface only.

**Verification**
- Open each `design-system/preview/*.html` file and compare your implementation side-by-side. The design reviewer will do the same.

---

## Non-negotiable constraints

| Rule | Detail |
|---|---|
| **Dark-first** | No light theme. Push contrast — this is read across a table in a dim room or full sunlight. |
| **State is colour** | Signal green = live/go · Amber = caution/pending · Red = Heat/danger · Cyan = telemetry/links. Never use these colours decoratively. |
| **No emoji** | Lucide stroke icons only. No emoji, no filled icons, no duotone. |
| **No CDN at runtime** | Fonts and icons must be bundled or self-hosted before the E0 scaffold ships. |
| **Two voices, quarantined** | UI chrome: plain, terse, UPPERCASE (Saira Condensed / JetBrains Mono). Teleprompter: cinematic second-person (IBM Plex Sans, green-200). Never mix in the same element. |
| **Glows sparingly** | `--glow-accent`, `--glow-heat`, `--glow-data` mark the *one live element* on screen. Not decoration. |
| **Motion restrained** | `--dur-fast` (90ms) state changes · `--dur-base` (160ms) hovers · `--dur-slow` (280ms) transitions. No bounces, no parallax, no infinite loops. |
| **Tight radii** | `--radius-xs` (2px) / `--radius-sm` (4px) / `--radius-md` (7px) / `--radius-lg` (12px) / `--radius-pill`. Buttons and cards use `md`; nothing bubbly. |

---

## For design exploration (prototypes and mocks)

Use the `the-job-design` skill (`design-system/SKILL.md`) — it loads the design context and lets you generate HTML artifacts directly from the brand. Do not use it for production code changes.
