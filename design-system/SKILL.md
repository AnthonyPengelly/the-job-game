---
name: the-job-design
description: Use this skill to generate well-branded interfaces and assets for "The Job" — an offline GM-tool web app for a co-operative tabletop heist game — either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

`colors_and_type.css` is the source of truth for all design tokens (colour, type, spacing, radius, elevation, motion) and semantic type classes — link it or copy its `:root` block. The two UI kits in `ui_kits/` (GM Console, Player View) are high-fidelity component recreations you can lift patterns from. The `preview/` folder holds specimen cards documenting every token and component.

Key constraints to honour:
- **Dark-first, daylight-legible.** Push contrast; this is read across a table in a dim room or bright sun. No separate light theme.
- **State is colour:** signal green = live/go, amber = caution/pending, red = Heat/danger, cyan = telemetry/links.
- **Two voices:** plain & functional UI chrome (UPPERCASE labels, terse) vs. cinematic second-person teleprompter narration (the only place with flavour).
- **Type:** Saira Condensed (headers, caps) · JetBrains Mono (all numbers/labels) · IBM Plex Sans (body + teleprompter). Google Fonts — self-host for the offline app.
- **Icons:** Lucide stroke icons (1.75px), tinted by semantic colour. Never emoji.
- Crisp small radii, hairline borders, subtle grain, glows only for the one LIVE element. Restrained motion.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
