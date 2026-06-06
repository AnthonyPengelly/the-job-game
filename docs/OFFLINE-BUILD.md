# OFFLINE-BUILD.md — The Job

How to produce and run the offline `file://` artifact. No server, no `localhost` — one double-click.

---

## What "offline" means here

`npm run build` produces two self-contained HTML files in `dist/`:

| File | What |
|------|------|
| `dist/index.html` | GM console (the main app — run this one) |
| `dist/player.html` | Player-view surface (optional second window) |

Every byte the app needs — JavaScript, CSS, fonts, and audio buffers — is inlined into the HTML files as data URIs. There are **zero runtime network requests** from the app code itself. Opening either file from the local filesystem works with no dev server, no web server, and no internet connection.

---

## Producing the artifact

```bash
npm install          # first time only
npm run build        # outputs dist/index.html and dist/player.html
```

`npm run build` runs `scripts/build-offline.mjs`, which executes two sequential Vite passes (one per entry point — multi-page inlining requires separate builds). Each pass uses:

- `base: './'` — relative asset references, safe for `file://`
- `vite-plugin-singlefile` — inlines all JS and CSS into the HTML
- `assetsInlineLimit: () => true` — inlines every asset (fonts → data URIs inside the CSS, audio buffers → data URIs in the JS import graph)
- `inlineDynamicImports: true` — merges all chunks into one script per entry

The `offline-selfcontained` sensor (`scripts/sensors/offline-selfcontained.mjs`) is wired into `npm run check:full`. It rebuilds from source and asserts the result has no external script src, no external link href, no absolute-path asset references, no CDN URLs, and no runtime `fetch('sound/…')` file-path calls. Run it manually at any time:

```bash
node scripts/sensors/offline-selfcontained.mjs
```

---

## Launching the GM console

**Double-click `dist/index.html`** in your file manager, or open it from the browser address bar:

```
file:///path/to/the-job/dist/index.html
```

The app starts on the **Setup** screen. No server, no flags, no extra steps.

### Recommended browser

Use a **Chromium-based browser** (Chrome, Edge, Brave). These handle `file://` most permissively:

- `localStorage` persists normally → resume saves, leaderboard, and settings all work.
- `BroadcastChannel` and `postMessage` work as expected.
- The Web Audio API starts after the first user gesture (click any button).

**Firefox** typically blocks `localStorage` writes under `file://` (a `SecurityError`). The app swallows this error gracefully — resume saves and leaderboard simply won't persist between sessions. All other features (engine, HUD, narration, audio, player-view) continue to work.

**Safari** blocks `localStorage` under `file://` by default and may also restrict `BroadcastChannel`. Same graceful degradation applies.

---

## Launching the player view (offline case)

The player-view surface (`dist/player.html`) is optional. It shows the Defuse the Alarm rulebook and an optional Getaway countdown for the players to watch.

**To open it alongside the GM console:**

1. Launch the GM console by opening `dist/index.html` as above.
2. Click **"Player view"** in the top-right of the console header. This opens `dist/player.html` in a new browser window via `window.open('player.html', 'the-job-player')`.

Opening `player.html` from the console button is important: it sets `window.opener` on the new window, which the player-view uses to send a registration message back to the console. Once registered, the console routes each `PlayerViewSlice` update via `postMessage` directly to the player window — the `file://`-safe transport introduced in E12.3.

The primary transport (BroadcastChannel) is also active and covers the served/dev case. Both paths run in parallel; the player-view accepts slices from either.

> If you open `dist/player.html` independently (not via the console button), the postMessage bridge will not connect and the player-view will show no updates. In that scenario, BroadcastChannel may still work if both documents share the same origin (same filesystem path, same browser profile, supported browser).

---

## Full run verified (QA — E12.5)

The following flow was verified against the self-contained build with a Chromium browser:

| Phase | Verified |
|-------|---------|
| **Setup** — crew names, player count, seed, dice mode | ✓ |
| **Briefing** — narration text, teleprompter read-aloud | ✓ |
| **Room (Obstacle)** — lane display, option selection, crew commit | ✓ |
| **Mini-game** — card negotiation game with timer and tally | ✓ |
| **Outcome** — clean/complication narration, Heat/Loot update in HUD | ✓ |
| **Offer** — push-on vs call-getaway choice | ✓ |
| **Getaway** — timer, round tracker, GM force-win/bust overrides | ✓ |
| **Result** — win screen, score, leaderboard entry | ✓ |
| **Undo Last / GM Overrides** — always-available override surface | ✓ |
| **Audio** — cues embedded as data URIs; AudioContext starts on first gesture | ✓ |
| **No external network requests** — only the initial HTML load; zero external assets | ✓ |

Audio decode warnings in headless test environments (e.g. Playwright, Docker without codecs) are due to the placeholder stub WAV files used during development. In a production build with real audio files, cues decode and play normally after the first user gesture.

---

## Offline-build troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Blank page, CORS error in console | Opened `index.html` from inside an archive or from a path with unusual characters | Extract to a normal directory and open from there |
| Audio plays nothing | Browser autoplay policy — expected | Click any button first; audio starts after a user gesture |
| Resume / leaderboard not saved | Browser blocks `localStorage` under `file://` (Firefox, Safari default) | Use Chrome/Edge, or serve locally with `npx serve dist` |
| Player view shows no updates | `player.html` was opened independently, not via the console's "Player view" button | Close the player window and reopen via the console button |
| `dist/` missing | Build not run yet | Run `npm run build` |
| Sensor fails after a code change | A change introduced a non-inlined asset or file-path audio fetch | Run `node scripts/sensors/offline-selfcontained.mjs` to see the specific violation |
