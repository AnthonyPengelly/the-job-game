# Frontend Redesign — Claude Design web prompt

> **What this is.** The prompt to drive a full visual redesign of *The Job* in **Claude Design web**,
> using the `the-job-design` skill (`design-system/SKILL.md`). The output is a **set of screen
> designs and their variants** (high-fidelity static HTML artifacts), which then become the spec for
> the build (**Epic E13** in `docs/EPICS.md`).
>
> **Scope rule for this prompt:** everything the designer needs is in `design-system/` — tokens
> (`design-system/colors_and_type.css`), philosophy and voice (`design-system/README.md`), the two
> UI kits (`design-system/ui_kits/gm-console/`, `design-system/ui_kits/player-view/`), and the token
> specimens (`design-system/preview/`). **Do not reference any file outside `design-system/`.** All
> product context the designer needs is inlined below.

---

## Paste-into-Claude-Design prompt

You are redesigning the entire interface for **The Job**, an offline single-page web app one person
(the **Game Master / GM**, "the guy in the van") runs on a laptop to drive a co-op tabletop heist
game for 2–7 players. The crew plays with physical cards at a table; the laptop is the rulebook,
narrator, soundboard and bookkeeper. **The crew never touches the laptop** — the one exception is an
isolated **player-view** surface.

The existing screens were built against a faulty layout and are being **redrawn from scratch**. The
**design system stays** — you build on it, you don't reinvent it. Honour `design-system/README.md`
and `design-system/colors_and_type.css` exactly:

- **Dark-first, daylight-legible.** Push contrast — read across a dim room or bright sun. No light theme.
- **State is colour:** signal **green** = live/go · **amber** = caution/pending · **red** = Heat/danger
  · **cyan** = telemetry/links. Never decorative.
- **Two quarantined voices:** UI chrome is terse **UPPERCASE** (Saira Condensed / JetBrains Mono);
  the **teleprompter** is cinematic second-person narration (IBM Plex Sans, green-200) — the only
  place with flavour. Never mix them in one element.
- **Lucide stroke icons** (1.75px), tinted by semantic colour, always paired with a mono-caps label.
  No emoji, no filled/duotone icons.
- Crisp small radii, hairline borders, subtle grain; **glows mark only the one LIVE element**.
  Restrained motion (`--dur-fast/base/slow`); no loops, bounces or parallax.

Lift patterns from `design-system/ui_kits/gm-console/` (`App.jsx`, `Hud.jsx`, `PhaseScreens.jsx`,
`Primitives.jsx`, `kit.css`) and `design-system/ui_kits/player-view/`, and verify tokens/components
against `design-system/preview/*`. Where this brief asks for something the kits don't yet show (the
cockpit edges, the mini-game lifecycle, the spoils/wrap-up beat, the overlays), design it **in the
same language**.

**Deliverable:** the full **screen set** in §Screens-to-produce below — each screen as a high-fidelity
static HTML artifact at a laptop viewport (**1280×800** baseline), and the listed **variants/states**
for each. These artifacts are the build spec; produce them all.

**Where the output goes:** save the artifacts into **`design-system/redesign/`**. Filenames are up to
you — just label each artifact's screen and variant in-canvas (see the manifest below) so it maps
back to the spec. This folder is the input spec for Epic E13.

---

### The product in one minute (so you can design it)

- **The run.** A stream of **rooms**. Each room is either an **Obstacle** (a security problem beaten
  with a tabletop **mini-game**) or a **Scenario** (a short narrated dilemma with two choices). After
  each room the GM is offered the door — **push on, or call the Getaway**. The run ends when the crew
  escapes (the **Getaway** finale) or **Heat** maxes and forces it. ~30 minutes, ~4–6 rooms typical.
- **Heat** — one shared meter, **0–20**, the whole tension. Rises every room and from loud/greedy
  play. At ~11 the "escape signal" fires ("getting hot — we can roll"); **20 forces** the Getaway at
  the worst odds. Heat is the **hero meter** — always on screen.
- **Loot** — the score. **Gear** — the build: **stat boosts** (+1 to a lane, common, *stack*) and
  **power-ups** (rare; exactly **four, one per lane**; don't stack; a player holds up to four). Gear
  is **assigned to a crew member** when it drops.
- **The crew & four lanes.** Everyone has four stats — **Tech · Physical · Charm · Stealth** — that
  start mediocre and grow via gear, making emergent specialists. A lane rating is the passive
  **difficulty dial** for that lane's games. Holding a lane's power-up unlocks a **shouted play** in
  that lane's games. **Exhaustion:** the crew who just played **rest the next room** (rotation).
- **Outcomes.** Every obstacle resolves **Clean** (full reward, low Heat) / **Complication** (partial
  reward, extra Heat — the comedic middle) / **Botched** (little/nothing, Heat spikes). Failure is
  soft — never a mid-run death.
- **Scaling 2–7** is invisible (the app deals an appropriately-sized job). Mini-games flex to the
  committed headcount.
- **GM is in charge; the app never blocks.** Every tracked value (Heat, Loot, stats, power-ups,
  exhaustion, outcome, phase) is **GM-editable at any time**, with **Undo on every change**. Design
  rule: **no dead-ends** — any state the app reaches, the GM can edit out of. Design the affordances
  for this.

**The ten mini-games** (Obstacle resolvers; lane(s) → on-screen job → the shouted boost(s)):

| Game | Lane(s) | What's on the GM's screen | Boost(s) |
|---|---|---|---|
| **Crack the Tumblers** | Tech | number-cards played in ascending order; a clash trips the alarm | Reset Pin |
| **Beat 16** | Physical | a metronome runs then mutes; tap the exact target beat | In the Bones |
| **Categories** | Charm | a category to read; tally valid answers against a count/timer | Skip |
| **The Once-Over** | Stealth | study an ~8–10 card spread, then spot which card changed | Hunch |
| **Follow the Circuit** | Tech+Physical | Simon: watch a growing sequence on a card grid, tap it back | Photographic / Muscle Memory |
| **Inside Knowledge** | Tech+Charm | rapid trivia; GM reads Q, sees A, marks right/wrong vs the clock | Cheat Sheet / Narrow It Down |
| **Safe-Crack** | Tech+Stealth | Mastermind: guesses against a hidden code, with "right digit / right place" feedback | Stethoscope / Patient Touch |
| **Assembly Line** | Physical+Charm | frantic card-trading; GM tallies completed sets vs the clock | Quick Hands / Tip-Off |
| **Steady Hands** | Physical+Stealth | build a card tower to a target height (physical/off-screen); GM times + judges | Extra Hands / Steady Breath |
| **Defuse the Alarm** | Charm+Stealth | **player-view** shows one player the rulebook; GM/others see the wire-cards; cut only safe wires | Clear Channel / Spare Wire |

---

### The layout direction: a fixed "cockpit", not a scrolling page

Design the GM console as **one master cockpit screen** that fills the viewport and **never scrolls the
page**. Persistent **information and control-launchers live around the edges**; **one large, calm work
stage sits in the middle** and is the only thing that changes per phase. Only an over-full *region*
(a 7-player crew rail, an opened overrides panel, the full soundboard) scrolls **inside its own
border** with an edge fade — never the document.

```
┌─────────────────────────────────────────────────────────────────────┐
│ TOP RAIL   THE JOB · PHASE · ROOM 3       ▓▓▓▓▓▓░░░░░ HEAT 8/20   $420 │  meters: always on
├──────────┬──────────────────────────────────────────────┬───────────┤
│  CREW     │   ┌───────────────────────────────────────┐  │  TOOLS    │
│  RAIL     │   │  TELEPROMPTER STRIP   read-aloud  Next │  │  (icons)  │
│           │   └───────────────────────────────────────┘  │           │
│  ▢ Sara   │                                               │  ◌ Sound  │
│  ▢ Jon    │            THE WORK STAGE                      │  ◌ GM     │
│  ▢ Mia    │     (phase content / mini-game / getaway)      │  ◌ Gear• │
│  (rest…)  │                                               │  ◌ Set    │
│           │                                               │  ↺ Undo   │
├──────────┴──────────────────────────────────────────────┴───────────┤
│ ACTION BAR   [contextual sound cues …]        [secondary]  [PRIMARY]  │
└─────────────────────────────────────────────────────────────────────┘
```

A coherent map for the GM's eyes and hands — stable across every phase, only the stage swaps:

- **Top rail = the meters.** Brand · phase · room, the **Heat track** (20 slots, glow on the live
  slot, single pulse on change — see `design-system/preview/comp-heat-track.html`), and **Loot**.
  These two numbers are always visible.
- **Left rail = the crew.** Avatars (bigger and more legible than the kit's 38px dot — see
  `design-system/preview/comp-crew.html`), each showing the four lane stats compactly, power-up pips,
  and exhaustion/in-play state. **Click a member → a crew-detail popover** that is also the per-player
  override surface. The rail doubles as the **commit** surface (obstacles) and **attempter-picker**
  (scenario rolls).
- **Right rail = the tools.** Launcher **icons** that open overlays *as needed* — **Soundboard**,
  **GM Overrides**, **Gear** (badged when gear is unassigned), **Settings** — plus the always-present
  **Undo** (a button, never a modal). Default state is the clean stage; nothing dense is permanently
  mounted.
- **Bottom = the action bar.** The phase's single obvious **primary CTA** (right), secondary/back
  (left), and a thin row of the **2–5 contextual soundboard cues** for this exact moment, near the
  GM's hands.
- **Centre = the work stage.** The interesting bit. One idea at a time; the **teleprompter is a
  fixed-height strip at the top of the stage** (one beat, large, `t-teleprompter`, `Next`) — never an
  element that grows and pushes content off-screen.

**Overlay strategy — pop controls out only as needed:**
- **Drawer** (slides from an edge, stage stays visible): the **full Soundboard**, the **GM Overrides**
  panel — things the GM dips into mid-performance.
- **Popover** (anchored to its trigger): **crew detail/override** (from a rail avatar),
  **gear-assign target**, **commit-crew**, **dial info**.
- **Dialog** (centred, blocking, scrim): **Settings**, **confirm-destructive** (new job / abandon
  run), **reopened gear assignment**.

---

### Two interaction rules that the old design got wrong — design these explicitly

**(1) Mini-games arm, then START — they never run on load.** Every mini-game uses one **shared
three-state lifecycle**, designed once and applied to all ten:

1. **ARMED / brief** (the default on entry): the stage shows the game name, the **GM's read-aloud
   script** for this game, a **GM-only difficulty readout**, the cards/setup laid out **static (not
   live)**, and **which committed player holds which boost** (so the GM can prompt the shout). The
   **timer is shown but not running.** One big **`START`** CTA in the action bar. *Timed rooms must
   never start the clock until START.*
2. **ACTIVE** (after START): the live challenge with **visible mode/state** (colour + iconography, not
   a line of prose), **progress as a meter** (not a buried count), boost buttons that surface only for
   committed holders and **fire once then disable**, and **no layout shift** when a boost/state fires
   (reserve the space). Timer can pause.
3. **RESOLVE**: the **outcome control** — Clean / Complication / Botched, with the suggested tier
   pre-selected and the comedic middle one tap away; the GM **confirms** (the app never overrides) →
   the **Spoils/Wrap-up** beat.

Standard stage zones for every game so the GM always knows where to look: **status** (mode · timer ·
progress) · **challenge** (the cards/question/clock — the hero) · **referee** (boosts · outcome).

**(2) After every room there's a Spoils / Wrap-up beat — and that's where gear is shared out.** The
old design kept a permanent "add any gear now — to whom?" tray on screen; **delete it.** Instead, when
an obstacle (or a rewarding scenario) resolves, a short **closing stage** before the Offer:
1. **Outcome named** with its sting (teleprompter quip).
2. **Spoils announced** — Loot gained, and/or the **Gear card(s) that dropped**, face-up and named
   (e.g. "Skeleton Key → Tech power-up").
3. **Share the gear out, here and now** — drag each dropped card **onto a crew member on the left
   rail** (tap-card → tap-crew as the accessible equivalent). Stat-boost cards that are "lane of
   choice" let the GM pick the lane; power-ups snap to their lane. This is the **only** routine place
   gear is assigned — a *moment*, not a fixture.
4. **Exhaustion** — show who just played and now **rests next room**, glanceable, so the GM can
   announce it.
5. **`CONTINUE`** → Offer. If gear is left unassigned, the right-rail **Gear** launcher keeps a badge
   and reopens assignment as a dialog (no dead-ends).

---

## Screens to produce

Produce **every** screen below as a high-fidelity HTML artifact at **1280×800**, plus each listed
**variant**. Group them so the set reads as one coherent system. (Also include responsive notes for
**1024×640** and **1920×1080**, but the deliverable artifacts are at baseline.)

**0 · Cockpit shell** — the frame itself, stage empty, to establish the edges.
- Variants: **Heat cool** (low, green-lit) · **Heat hot** (high, red, escape-signal amber state in the
  top rail) · **crew rail at 3 players** · **crew rail at 7 players** (internal scroll).

**1 · Setup** — assemble the crew.
- New job: crew-size stepper (2–7), name + starter-quirk per player.
- **Advanced** disclosure open (optional seed, dice-mode app-roll vs physical-die).
- **Resume-or-new** variant: a resumable-save prompt + a personal-best leaderboard side panel.

**2 · Briefing** — mansion dressing, opening narration to perform, order of play, `BEGIN`.

**3 · Obstacle room**
- Clue + the **2–3 option cards** (game · reward · Heat cost · risk/safe), before selection.
- **Option selected → commit-crew** state (left rail in "committing N–M" mode, the chosen option
  highlighted, `COMMIT` CTA).

**4 · Scenario room**
- Set-up + **two blind choice cards** (flavour only — no lane/odds shown).
- **Roll → pick attempter** (rail in attempter-pick mode).
- **Roll → transparent reveal**: lane · attempter's rating · base difficulty · resulting **DC/odds**,
  then the roll control (app-roll **and** physical-die-entry variants).
- **Non-roll reveal**: the hidden effect surfaced.

**5 · Mini-game lifecycle** — the universal shell first, then the ten games.
- **5a Shell — ARMED** (generic): script, GM-only dial readout, static setup, boosts-available, `START`.
- **5b Shell — ACTIVE** (generic): live status/challenge/referee zones.
- **5c Shell — RESOLVE** (generic): the Clean/Complication/Botched outcome control.
- Then the **ACTIVE** screen for each game, with the variants that matter:
  - **Crack the Tumblers** — playing the ascending run; **alarm-tripped** variant.
  - **Beat 16** — metronome with a **visible beat pulse**, count-to target, big TAP; hit/early/late feedback.
  - **Categories** — the category large; prominent **tally** control + count; timer pressure.
  - **The Once-Over** — **study** vs **identify** modes as two distinct variants; flagged cards shown once.
  - **Follow the Circuit** — **watching** vs **your-turn** as two distinct variants; live-beat label; round-length meter.
  - **Inside Knowledge** — Q + GM-only A with clear hierarchy; Correct/Wrong + progress; **Narrow-It-Down** options variant.
  - **Safe-Crack** — readable **guess history** (right-digit vs right-place as pips); **Stethoscope reveal** variant.
  - **Assembly Line** — set-complete tally as hero; **Tip-Off (types-in-play revealed)** variant. (Same language for its negotiated 2-player variant.)
  - **Steady Hands** — target-height read, timer, boosts; **Extra-Hands 10s burst** variant (a clear secondary countdown distinct from the main timer).
  - **Defuse the Alarm** — GM referee view: the wire-cards as hero + the rulebook as glanceable reference; **alarm-tripped** and **wrong-cut-forgiven** variants. (Its player-facing rulebook is screen 11.)

**6 · Spoils / Wrap-up** (new)
- Outcome + Loot announced.
- **Gear drop + assign** (dragging a card onto a crew member; show a mid-drag state).
- Exhaustion/rest + `CONTINUE`.
- Variant: **gear left unassigned, reopened as a dialog**.

**7 · Offer** — push-or-run.
- **Cool** variant (calm) · **hot / escape-signal** variant (amber "getting hot — we can roll").

**8 · Getaway** — the finale, decluttered.
- **ARMED** (START to begin).
- **ACTIVE**: clock as hero (calm green), compact horizontal round bar (target · cleared meter ·
  clue-giver), action row (`Cleared` · `Ditch (+Heat)` · `Skip card` · `Buy seconds`).
- **Near-bust** variant (clock red, time draining).

**9 · Result** — `WIN` variant and `BUST` variant: big verdict, sting, score breakdown
(loot banked · Heat at getaway · multiplier), personal-best/rank, `GO AGAIN`.

**Overlays** (show each over a representative stage):
- **10 · Soundboard** — the **quick-cues** row in the action bar **and** the **full board drawer**
  (channels: Ambient/tension · Heist SFX · Stings · Danger · Finale; mute + volume).
- **11 · GM Overrides drawer** — sectioned: **Heat** (±/set) · **Loot** (±/set) · **Room** (re-roll /
  skip) · **Phase** (jump). Persistent **Undo**.
- **12 · Crew detail popover** — from a rail avatar: the four stats (±/set), the four power-up toggles,
  rested/un-rested, gear held, rename.
- **13 · Settings dialog** — dice-mode, audio, seed.
- **14 · Confirm-destructive dialog** — e.g. abandon run / new job.

**Player-view** (the isolated player-facing surface — no GM chrome, no Heat internals, fluid type,
glanceable from across the room; lift from `design-system/ui_kits/player-view/`):
- **15 · Defuse the Alarm rulebook** (the rulebook one player reads).
- **16 · Getaway countdown** (big clock for the table).

For each artifact, label the screen and its variant, and annotate the key zones (which rail, which
state, which token/colour-semantic is doing the work) so the build can map design → implementation.

---

## Epic E13

This redesign is tracked as **E13 — GM Console & player-view redesign (cockpit)** in `docs/EPICS.md`.
The screen set produced from this prompt is its input spec; E13's acceptance gate mirrors the
interaction rules above (single cockpit, no document scroll, edge meters + crew always on, overlays
summoned/dismissed, every timed mini-game arms-then-START, a Spoils/Wrap-up beat with in-the-moment
gear sharing and **no persistent gear tray**, mini-games readable at a glance, no dead-ends,
player-view leaks nothing, tokens/voices/iconography per the design system).
