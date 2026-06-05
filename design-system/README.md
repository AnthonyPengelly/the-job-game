# THE JOB — Design System

A design system for **The Job**, an offline single-page web app (React + Vite) that one person — the **Game Master (GM)** — runs on a laptop at a table while 2–7 players play a co-operative heist game with physical cards.

The laptop is the **rulebook, narrator, soundboard, and scorekeeper**. It is *never handed to players* — it's a GM tool read from **across a table**, in a dim room or in bright sunlight (it travels). Every decision in this system bends toward one goal: **legibility at arm's length** without losing the tense, analogue heist mood.

> **Sources:** This system was authored from a written product brief — there was **no existing codebase, Figma, or asset library** to import. All visuals are original. The aesthetic was chosen from two proposed directions ("analogue heist thriller" and "hacker-van CCTV ops") and resolved into a **hybrid**: heist-thriller darkness on a hacker-HUD legibility chassis.

---

## The two surfaces

1. **GM Console (primary).** A persistent HUD across the top — **Heat track (20 slots)**, **Loot counter**, **crew panel**, **gear tray** — with phase-specific screens below it: **Setup → Briefing → Obstacle room → Scenario room → Offer → Getaway → Result**. This is the workhorse and the priority.
2. **Player View (secondary, isolated).** A minimal, read-only surface shown on a second display or passed around briefly — one mini-game's rulebook and an optional Getaway countdown. No GM chrome, huge type, glanceable.

---

## Design philosophy

- **Read it, don't operate it.** The GM glances at the screen between narration and table-watching. Information hierarchy beats density. Big numbers, clear state colour, one idea per panel.
- **Dark, but daylight-proof.** Dark-first for mood and for dim rooms, but contrast is pushed hard so it survives a sunny table outdoors. We do *not* ship a separate light theme; we ship a dark theme that doesn't wash out.
- **State is colour.** Green = live/go. Amber = caution/pending. Red = Heat/danger. Cyan = telemetry/links. Neutral = idle. A GM should read the room's state from six feet away by colour alone.
- **Tactical, not neon.** Worn van-interior darks, crisp small corners, equipment-panel chrome. A whisper of grain and a phosphor-green signal — not casino glitz, not cyberpunk neon.

---

## CONTENT FUNDAMENTALS

The app has two distinct voices. Keep them separate.

### 1. UI chrome — plain & functional
Labels, buttons, counters, and helper text are **terse, literal, and instructional**. The GM is mid-game; words must parse instantly.

- **Casing:** HUD labels and button text are **UPPERCASE** set in the display or mono face (`HEAT`, `RAISE HEAT`, `NEXT ROOM`, `LOOT`). Sentence case for helper prose.
- **Voice:** Imperative for actions (`Deal one Gear card`, `Reveal the Offer`). Neutral declaratives for status (`Round 3 of 6`, `2 gear remaining`).
- **Person:** Second person when instructing the GM (`Choose who goes first`). Never first person; the app has no personality in the chrome.
- **Numbers:** Always digits, never spelled out (`12 / 20`, `$48.5k`, `0:45`). Tabular figures.
- **Emoji:** **Never.** Iconography is Lucide stroke icons only.
- **Length:** A button is 1–3 words. A helper line is one sentence. If it needs two sentences, it belongs in the teleprompter.

Examples:
> `BEGIN HEIST` · `RAISE HEAT` · `SKIP ROOM` · `REVEAL OFFER` · `Deal one Gear card to each player, face-down.` · `Round 3 of 6` · `Cover blown — resolve the Getaway.`

### 2. Teleprompter — in-world narration
The read-aloud text the GM performs to the table. This is where the **heist atmosphere lives**. It is *the only place* with flavour.

- **Voice:** Cinematic second person, present tense, tense and cool. `You're between floors. The patrol loops back in ninety seconds.`
- **Casing:** Normal sentence case, set large in IBM Plex Sans / green-200.
- **Tone:** Confident, spare, slightly noir. Short sentences. Concrete detail (a crackling radio, a shuddering elevator) over adjectives.
- It is **visually quarantined** from the chrome by the green left-rule + tint block so the GM's eye finds "what to say" instantly.

Rule of thumb: **chrome tells the GM what to do; the teleprompter tells the GM what to say.**

---

## VISUAL FOUNDATIONS

**Colour vibe.** Cool-neutral near-black "van interior" darks with a faint green cast. A single saturated **signal green (`#1FD06E`)** does almost all the accent work — it's the phosphor of an old CCTV monitor. Amber, heat-red, and data-cyan are reserved strictly for meaning, never decoration. Imagery (if any) should be **cool, low-key, slightly desaturated** with grain — never warm or glossy.

**Typography.** Three faces, three jobs:
- **Saira Condensed** — tactical signage. Phase titles, screen headers, the wordmark, button labels. Always UPPERCASE, tight tracking.
- **JetBrains Mono** — every number and machine label. Heat count, Loot, timers, IDs, overline labels. Tabular figures so counters don't jitter.
- **IBM Plex Sans** — humanist body for rules text, helper copy, and the read-aloud teleprompter. Calm and legible; never shouts.

**Spacing.** 4px base grid (`--space-1..9`). Generous padding inside panels (16–24px); HUD packs tighter. Whitespace is used to separate the *live* thing from everything else.

**Backgrounds.** No photos or illustrations in chrome. The canvas is a **warm-dark radial vignette** (subtly lighter at top) over the deepest void. The **default surface is clean** — vignette only — for maximum legibility across a table. A **fine film grain** and a **scanline overlay** (the "hacker" look) are available as opt-in tweaks but are off by default. Texture is always *subtle* — never enough to cost legibility. No gradients as decoration; the only gradients are the vignette and the teleprompter tint-fade.

**Borders.** Hairlines are low-alpha cool-white (`rgba(170,200,195,.10)`), occasionally strengthened (`.20`). Borders — not heavy shadows — define most edges. This is an equipment-panel look.

**Corner radii.** Tight and crisp: `xs 2 / sm 4 / md 7 / lg 12 / pill 999`. Buttons & cards use `md`; chips & inputs use `sm`; only status badges go full `pill`. Nothing is soft or bubbly.

**Shadow & elevation.** Three soft dark drop-shadows (`elev-1..3`) each paired with a 1px inner top-light to fake a lit edge. Depth is restrained. **Glows** (`glow-accent`, `glow-heat`, `glow-data`) are the loud tool — a coloured ring + soft bloom that marks the one **LIVE** element on screen (active phase, rising Heat).

**Cards / panels.** Surface-1 fill, hairline border, `lg` radius, `elev-2`. A raised header bar (surface-2) carries the title + a mono phase tag. The **active** panel swaps its border to green-700 and gains `glow-accent`.

**Transparency & blur.** Used sparingly: tint surfaces (green/amber/red/cyan `-900`) are semi-opaque colour washes behind badges and the teleprompter. Backdrop-blur is reserved for the few modal overlays (e.g. confirm "Blow the job?"). Chrome is otherwise opaque for max contrast.

**Animation.** Restrained and purposeful. Fast (`90ms`) state changes, base (`160ms`) for hovers/reveals, slow (`280ms`) for phase transitions. Easing is `--ease-out` (decelerate). The Heat slot **pulses once** when it fills; the Getaway clock ticks with a subtle scale. **No** infinite decorative loops, no bounces, no parallax — motion never competes with the table.

**Hover / press.** Hover lightens the surface one step (surface-3 → surface-4) and, on primary/danger, adds the matching glow. Press darkens to the `-press` token and nudges `translateY(1px)` — a physical "key" feel. Disabled = 40% opacity, no pointer.

**Layout rules.** The HUD is **fixed** to the top of the GM Console at all times; phase screens scroll beneath it if needed. Controls (Next/Skip/Raise Heat) live in a fixed action bar so the GM's hands always know where they are. The Player View has *no* fixed chrome — it's all content.

---

## ICONOGRAPHY

- **System:** [Lucide](https://lucide.dev) (the maintained fork of Feather), loaded from CDN. There is **no bespoke icon font** — Lucide's even, light stroke matches the tactical-instrument feel and stays crisp at arm's length.
- **Style:** **Stroke icons only**, `stroke-width: 1.75`. Never filled, never duotone. Line weight matches the hairline borders.
- **Colour:** Icons inherit `currentColor` — tint them with the semantic colour of their meaning (`flame` in heat-red, `banknote` in signal-green, neutral `fg-muted` otherwise).
- **Sizing:** 20–24px inline in the HUD; up to 30px as a section glyph. Always paired with a mono caps label — icons clarify, they don't replace text.
- **Emoji & unicode:** **Never** use emoji. A few geometric unicode marks (`⬤` live dot, `⬡` gear hex, `—` em-dash) appear as typographic accents, not as icons.
- **Key glyphs:** `flame` (Heat), `banknote` (Loot), `users` (Crew), `briefcase` (Gear), `timer` (Getaway), `cctv` (watch), `dice-5` (roll), `door-open` (room), `skip-forward` (skip), `volume-2` (SFX).

> **Substitution flag:** Lucide is a substitute chosen by this system, not an inherited brand asset (there was no source library). It's loaded from CDN in previews; the offline app should bundle the Lucide icons it actually uses.

---

## Fonts — caveat

All three faces are **Google Fonts** (Saira Condensed, JetBrains Mono, IBM Plex Sans), pulled via CDN `@import` in `colors_and_type.css`. **The Job is an offline app** — these must be **self-hosted** (woff2 in `/fonts`) in production so it works with no network. I could not download the binaries into this project from here; **please drop the woff2 files into `fonts/` (or confirm these three faces are right) and I'll wire up local `@font-face` rules.**

---

## Index — what's in this system

| File | What it is |
|---|---|
| `README.md` | This file — context, content & visual rules, iconography, index |
| `colors_and_type.css` | **The source of truth.** All design tokens (colour, type, spacing, radius, elevation, motion) + semantic type classes |
| `SKILL.md` | Agent-Skills-compatible entry point for reusing this system |
| `preview/` | Design-system specimen cards (colours, type, spacing, components, brand) — shown in the Design System tab |
| `ui_kits/gm-console/` | **GM Console** UI kit — HUD + phase screens, as interactive JSX components |
| `ui_kits/player-view/` | **Player View** UI kit — minimal read-only rulebook + Getaway countdown |
| `assets/` | Logos / shared static assets |

### UI kits
- **`ui_kits/gm-console/index.html`** — the primary console: persistent HUD with a click-through of the Setup → Briefing → Obstacle → Offer → Getaway → Result phases.
- **`ui_kits/player-view/index.html`** — the isolated player surface: one mini-game rulebook + optional countdown.
