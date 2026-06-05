# Assets

*The Job* has **no raster logo or imported brand imagery** — there was no source asset library, and the identity is deliberately **typographic**. The wordmark is built from type + a single accent square, so it stays crisp at any size and recolours with the signal-colour tweak.

- **Wordmark / lockups:** see `../preview/brand-logo.html` (stacked wordmark + compact mono HUD lockup). The HUD lockup is implemented live in `../ui_kits/gm-console/Hud.jsx` (`.lockup`).
- **Icons:** [Lucide](https://lucide.dev), loaded from CDN. Bundle the specific icons you use for the offline app. See the ICONOGRAPHY section of the root `README.md`.
- **Fonts:** Google Fonts (Saira Condensed, JetBrains Mono, IBM Plex Sans) — **self-host woff2 here** (`fonts/` or `assets/fonts/`) for the offline build. See the Fonts caveat in the root `README.md`.

If you have real brand assets (a printed-card aesthetic, box art, a bespoke logo), drop them here and I'll fold them into the system.
