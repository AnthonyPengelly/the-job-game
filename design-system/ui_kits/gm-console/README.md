# GM Console — UI kit

The **primary** surface of *The Job*: the laptop screen the Game Master reads from across the table. A persistent HUD pinned to the top, a scrolling phase screen below, and a fixed action bar.

Open **`index.html`** for the interactive click-through (Setup → Briefing → Obstacle → Offer → Getaway → Result). Use the phase rail or the action bar to move between phases; **Raise Heat** lights the next slot (with a pulse); the Getaway clock counts down. State persists to `localStorage`.

## Files
| File | Role |
|---|---|
| `index.html` | Loads React + Babel + Lucide + the components |
| `kit.css` | Layout + component classes (builds on `../../colors_and_type.css`) |
| `Primitives.jsx` | `Icon` (Lucide wrapper) + `Button` |
| `Hud.jsx` | `Hud`, `HeatTrack`, `Chip` — the persistent top bar |
| `PhaseScreens.jsx` | One component per phase + `PhaseHead`, `Teleprompter` |
| `App.jsx` | Phase state machine, action bar, Tweaks wiring |
| `tweaks-panel.jsx` | Tweaks shell (toolbar-toggled) |

## Tweaks
Toggle the Tweaks panel from the toolbar to explore the directions you asked about:
- **Signal colour** — green (default) / amber / cyan
- **Surface texture** — clean (default) / grain / scanlines

## Notes
- Components export to `window` (Babel scripts don't share scope) — load order in `index.html` matters.
- This is a cosmetic recreation, not game logic: outcomes are illustrative click-throughs, not rules enforcement.
