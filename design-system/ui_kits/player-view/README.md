# Player View — UI kit

The **secondary**, isolated surface. Shown on a second display (or passed around briefly) so players can read the rules for the current mini-game, or watch the Getaway countdown. **No GM chrome** — huge type, centred, glanceable from anywhere in the room.

Open **`index.html`**. A small *kit-preview* switch at the bottom flips between the two states; in the real app the GM controls which is shown.

## States
- **Rulebook** — one mini-game: title, one-line lede, numbered steps, and the pass-check banner.
- **Countdown** — full-screen Getaway clock; turns red and pulses under 15 seconds.

## Files
| File | Role |
|---|---|
| `index.html` | Loads React + Babel + the component |
| `player.css` | Fluid (`clamp`/`vh`) type + layout — scales to any display |
| `PlayerView.jsx` | `PlayerView`, `Rulebook`, `Countdown` |

## Notes
- Everything is `clamp()`-sized against viewport height so it fills a TV or a laptop without a fixed canvas.
- The bottom switch is a kit affordance only — it is **not** part of the real player surface.
