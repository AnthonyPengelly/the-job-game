# EPICS.md — The Job build backlog

The authoritative work breakdown. The orchestrator builds these **in dependency order**. Each epic lists its goal, stories, dependencies, and a hard **acceptance gate** (what must be true to call it done). The planner agent turns each epic into numbered tasks; the builder implements task-by-task; reviewers gate each merge; a QA pass closes the epic. See `docs/ORCHESTRATION.md`.

Epic IDs are stable (`E0`–`E20`). Never renumber — scripts, branches (`epic/E5-...`), and reviews reference them.

> **Adding a new epic? Two steps, not one.** (1) Add the `## E<n> — …` section here. (2) **Append its
> ID to the `DEFAULT_ORDER` array in `scripts/agents/orchestrate.sh`**, in dependency order — the
> big-bang build walks *that list*, not these headings, so an epic added here but not wired there is
> **silently never built**. The orchestrator warns about any epic in this file that's missing from
> `DEFAULT_ORDER`, but don't lean on the warning — wire it. See `docs/ORCHESTRATION.md` §3.

> **E14–E20 are the playtest-feedback wave.** They follow the first full-build playtest of the
> completed E0–E13 app. E13 redrew the console against the `design-system/redesign/` mockups but was
> **presentation/IA-only** — it could not implement the engine, content and economy those mockups
> already assume (gear on every room, big-number Loot, a dramatic roll reveal, the Spoils gear-share,
> a ditch that drops Loot, working audio). **E14–E20 build that substance and close the fidelity gap.**
> Unlike E13, **these epics are explicitly authorised to change the engine, content, presets and the
> balance targets** where each story says so — and two of them revise the design doc itself (the doc's
> v0.9 note records this). They still honour the golden rules (pure engine, preset-as-data, determinism,
> no dead-ends, parse-at-boundary, tests+balance green) and the design system as the source of truth
> for presentation.

---

## Dependency graph

```
E0 → E1 → E2 ┐
             ├→ E3 → E4 → E5
             │       ├→ E6
             │       ├→ E7
             │       ├→ E8
             │       └→ E9
             └──────────→ E10
E1 → E11   (anytime after engine)
E5..E10 → E13   (frontend redesign; needs the functional app + games + getaway + audio)
E13 → E14 → E15            (economy before heat-scaling — scaling re-tunes the new magnitudes)
E13 → E16, E17, E18, E19, E20   (playtest fidelity wave; mostly independent of each other)
all → E12  (last, optional)
```

Critical path: **E0 → E1 → E2 → E3 → E4 → E5**. E6–E9 fan out from E3/E4 and can be built in any order (or in parallel by separate agent runs). E10 needs E3. E11 needs E1. **E13 supersedes E10's visual pass** and needs the functional surfaces it redraws (E5 games, E6 Getaway, E7 scenarios, E8 narration, E9 audio, E10 leaderboard/resume). **E14–E20 follow E13** (the playtest-feedback wave). Within the wave: **E14 (economy) precedes E15 (heat-scaling)** because the scaling re-tune must run against the new Loot/Gear magnitudes; E16–E20 are largely independent and can run in parallel, though anything touching the Spoils/gear flow should land **E14 first**. E12 is last.

---

## E0 — Foundations & scaffold

**Goal:** a runnable empty app and the full toolchain the pipeline depends on.

**Stories**
- Vite + React + TS project; strict `tsconfig`; path aliases (`@/engine`, `@/content`, …).
- ESLint + Prettier; the import-direction lint rule (engine may not import React/console).
- Vitest configured; one passing example test.
- The seeded RNG (`mulberry32` or similar) in `src/engine/rng.ts`, with tests proving reproducibility.
- Folder skeleton: `src/{engine,content,minigames,console,player-view,platform}`.
- `npm` scripts wired (even if some are stubs that later epics fill): `dev`, `build`, `check`, `check:full`, `sim:check`, `content:validate`, `test`, `lint`, `typecheck`.
- Design tokens: copy `design-system/colors_and_type.css` into `src/console/theme/tokens.css` and import it at the app root; self-host the three Google Fonts (Saira Condensed, JetBrains Mono, IBM Plex Sans) as woff2 under `public/fonts/` with local `@font-face` rules replacing the CDN import. The design system is the source of truth — see `docs/DESIGN-SYSTEM.md` for the full checklist.

**Acceptance gate:** `npm run check:full` passes on an empty app; `npm run dev` serves a shell at localhost; RNG reproducibility test green; the import-direction lint rule actually fails when engine imports React (prove with a deleted-after test).

---

## E1 — Core rules engine

**Goal:** the pure, tested heart. The TS port of `docs/design/heat-model-simulation` logic, as the *same code that ships*.

**Stories**
- `RunState`, `RunEvent`, `reduce(state, event)` — pure, exhaustive, typed.
- Heat model: per-room drip, greedy surcharge, outcome Heat (clean/comp/botch), escalation ramp (~room 5+), escape signal (~Heat 11), forced Getaway at HMAX (20).
- Getaway resolution: Heat→(target, time)→odds, with crew-skill and headcount terms; win/bust; scoring with low-Heat style bonus.
- Room/scenario stream generation (procedural, seeded): obstacle option menus (game · reward · Heat cost), scenario draw without repeats, carried effects (ticking briefcase, 3-room unlock).
- All tunable numbers read from the **active preset**, never hardcoded (depends on the preset schema — co-develop the minimal loader here, full system in E10/E11 via `docs/CONTENT-AND-TUNING.md`).

**Acceptance gate:** unit tests cover every reducer branch; `npm run sim:check` runs the headless Monte Carlo over the default preset and **asserts** the design targets (median ~4–5 obstacles, runs past 10 rooms ≤ ~3%, win-rate bands by skill bad<avg<good, Loot roughly doubles poor→good). Numbers reproduce the reference model within tolerance.

---

## E2 — Crew, gear, scaling & GM overrides

**Goal:** track the crew and let the GM control everything.

**Stories**
- Player model: four lane stats, up to four power-ups (one per lane, no stack), starter quirk, exhaustion/rotation.
- Two reward layers: stacking stat boosts; the four lane power-ups. Gear assignment to a player.
- Scaling profiles (2–7) from the preset: exhaustion strength, crew-needed-per-option, per-game commit floors & dial curves.
- **GM override API on the engine:** typed events to set/adjust Heat, Loot, grant/remove any gear, set/clear exhaustion, force an outcome, re-roll/skip a room, jump phase. Every mutation is undoable (`UNDO_LAST`). **No engine state is a dead-end.**

**Acceptance gate:** property test — from any reachable `RunState`, every tracked field can be driven to any legal value via override events, and `UNDO_LAST` restores the prior state; scaling profiles deal correctly-sized jobs for n=2..7.

---

## E3 — Room loop & GM console shell (mini-games stubbed)

**Goal:** the whole run is playable end-to-end from the UI, with mini-games stubbed as a GM outcome-picker. First true playtest build.

**Stories**
- State store (Zustand) wrapping the pure engine; React renders from it.
- **Refresh-safe persistence at the store boundary:** write-through to `localStorage` after *every* engine event (save as `{ seed, eventLog }`); hydrate-on-boot before first render; schema-versioned + Zod-parsed (stale/mismatched save → loud fail + clean restart, never corruption). A hard refresh / tab close / crash mid-room reloads into the exact same state. (Leaderboard + visual polish are E10; this is just resume-survival, and it belongs here because it's a property of the store.)
- Screens: Setup (crew 2–7, names, quirks, seed; **Resume the job vs New job** when a save exists) → Briefing → Obstacle (clue, options, commit crew) → Scenario (choose, two-stage reveal stub) → Offer (push/run) → Getaway (stub) → Result → again.
- **Persistent HUD:** Heat track (0–20 face-down cards), Loot, crew gear/exhaustion.
- **Crew & gear direct-manipulation UI:** drag a dropped loot/gear card onto the player who takes it; HUD reflects holdings.
- **GM override surface:** always-available controls to edit Heat/Loot/gear/phase, plus "undo last".
- Mini-games stubbed: a "clean / complication / botched" picker that feeds the engine.

**Acceptance gate:** a human (or the QA agent) can play a complete run start→finish with only the stub picker; HUD always correct; every override works and undoes; no dead-end reachable (QA script asserts); **a hard browser refresh at any phase reloads into the identical state, and Setup offers Resume.**

---

## E4 — Mini-game framework + reference game

**Goal:** the `MiniGame` contract and shared primitives, proven by one real game.

**Stories**
- `MiniGame<Params, ChallengeState>` interface: `generate(rng, dial)`, `Component`, `judge`, `boosts`, `lanes`, `minCommit`, optional `soloVariantId`.
- Shared primitives: `Timer` (audible), `CardSpread`, `Metronome` (Web Audio — coordinate with E9), `BoostButton` (shows only for committed power-up holders, once-per-game), `OutcomeJudge` (GM confirms; app suggests tier), `DialReadout` (GM-only difficulty display).
- Dial-from-stat wiring: committed crew's lane rating(s) → difficulty.
- Reference game: **Safe-Crack** (exercises generation, deduction state, dial, both lane boosts, GM-confirm judging).

**Acceptance gate:** Safe-Crack runs inside the loop replacing its stub; regenerates fresh each play (seeded); dial visibly shifts with committed stats; both boosts fire once; GM confirms outcome and it feeds the engine.

---

## E5 — The ten mini-games

**Goal:** all ten games + their solo/scaling variants. Largest epic; ships game-by-game.

**Build order (by shared primitive reuse):**
1. Timer + GM-judge: **Categories, Inside Knowledge, Steady Hands**.
2. CardSpread: **The Once-Over, Assembly Line, Defuse the Alarm** (Defuse needs the player-view from E3/its own slice).
3. Metronome/sequence: **Beat 16, Follow the Circuit**.
4. Coordination/deduction state: **Crack the Tumblers** (+ its solo memory variant).

Each game includes: procedural generator, judging (app-assist + GM-confirm per `docs/MINIGAMES.md`), both boosts, and commit-size handling (`minCommit`, dial curve, variant where required — Crack the Tumblers solo variant; Assembly Line 2-player variant; Assembly Line & Defuse excluded from solo).

**Acceptance gate:** all ten playable and replayable; each respects its `minCommit` and dial; the two excluded games never appear in ineligible commit slots (generator test); Crack the Tumblers loads its variant solo.

---

## E6 — The Getaway finale

**Goal:** the Heat-scaled Articulate climax.

**Stories**
- Heat→(target cards, timer) mapping from preset; round-the-circle counter UI; ditch-for-Heat; gear-spend (skip card, buy seconds).
- Climax narration + sound hooks (coordinate with E8/E9).
- Uses the physical Articulate deck — app times, targets, scores; does not store cards.
- Optional player-facing Getaway display via the player-view surface.

**Acceptance gate:** a full run resolves into a tense, Heat-scaled finale producing the engine's win/bust + score; low Heat is generous, high Heat brutal, matching the model bands.

---

## E7 — Scenario content & rolls

**Goal:** all 44 scenarios as validated data with the two-stage roll reveal.

**Stories**
- Scenario schema (Zod); all 44 from `docs/design/heist-content.md` as data: set-up, two choices, hidden effects, lane-weighted rolls, carried effects.
- **Two-stage roll UX:** opaque to commit (flavour only) → on commit + pick-attempter, reveal lane, player rating, base difficulty, and the **d20 DC** (`DC = baseDifficulty − laneRating`, clamped 1–20; success on `roll ≥ DC`; odds shown as `(21−DC)/20`).
- **Dice mode setting** (persisted, default app-roll): **app roll** — after showing the DC, the app rolls a d20 from the seeded RNG; **physical roll** — the app shows the DC then waits for the GM to throw a real d20 and tap in 1–20. Both resolve against the same DC (balance-identical). Engine: the roll-resolution event takes an optional `externalRoll` — present → use it, absent → draw from the seeded RNG (engine stays pure; entered value is recorded in the event log so `{seed,eventLog}` replays exactly; a mistyped roll is undoable). Optional preset flag for nat-1/20 crit/fumble (default off).
- No-repeat draw within a run; resolves every currency (Heat/Loot/Gear/info/delayed).

**Acceptance gate:** content validates against schema in CI; rolls show the correct d20 DC = f(base difficulty, attempter lane rating); **both dice modes resolve a roll correctly (app-roll seeded & reproducible; physical-roll accepts 1–20, validates, and is undoable), and switching mode in settings persists across refresh**; blind-then-transparent flow verified by QA; no scenario repeats within a run.

---

## E8 — Narration bank & teleprompter

**Goal:** the run reads cinematically, never repeating.

**Stories**
- Narration content schema; many variants per beat (briefing, per-game clues, option descriptions, push/run, the three outcome quips, scenario set-ups, Getaway intro/countdown, win/bust stings).
- Non-repeating variant selector (avoid recently-used) seeded off the run RNG.
- Teleprompter presentation: large, paced, one beat at a time, GM-performable.

**Acceptance gate:** a full run surfaces no repeated line; tone stays consistent with the mansion dressing; selector is deterministic under seed.

---

## E9 — Audio engine & soundboard

**Goal:** the GM can score the whole run; metronome games feel tight.

**Stories**
- Web Audio subsystem: preload buffers, play/mix, an ambient bed nudged by Heat (drone low → heartbeat high).
- Context-sensitive soundboard: only buttons relevant to the current moment surface (ambient, heist SFX, stings, danger, finale).
- Shared `Metronome` (precise Web Audio clock) used by Beat 16 / Follow the Circuit.
- Sound manifest from preset.

**Acceptance gate:** soundboard surfaces correct buttons per phase; metronome timing accurate (test against audio clock, not setTimeout); ambient bed responds to Heat.

---

## E10 — Persistence, scoring history & polish

**Goal:** looks the part; full score history. (Refresh-safe run resume already shipped in E3 — this builds on that store.)

**Stories**
- Build on E3's persistence: add the **personal-best leaderboard** ("beat that number") and settings under their own keys; a finished run writes its score to history.
- **Visual pass against the design system** (`design-system/` in the repo root — read `design-system/README.md` first, then follow `docs/DESIGN-SYSTEM.md`). The design system is the source of truth; do not invent tokens, colours, or type choices. Implement every GM Console screen using patterns from `design-system/ui_kits/gm-console/` (HUD, phase screens, primitives, tweaks panel) and the Player View from `design-system/ui_kits/player-view/`. Verify each component against the `design-system/preview/` specimen cards. Specific requirements: Heat track 20-slot face-down-card fill with `--glow-heat` on the live slot; teleprompter block with green left-rule and `--accent-tint` wash; `--dur-slow` phase transitions; Lucide stroke icons offline-bundled (never CDN).
- Accessibility/glanceability: big hit targets, readable across a room; performance.

**Acceptance gate:** a finished run appears on the leaderboard and persists across refresh/restart; mid-run resume still works (regression check on E3); every screen matches the design-system preview specimens and is approved by the design reviewer; no CDN requests at runtime (fonts and icons are bundled/self-hosted); no major a11y/perf regressions.

---

## E11 — Tuning panel & preset tooling

**Goal:** retune the game without leaving the app or editing code.

**Stories**
- Preset system fully realised (depends on `docs/CONTENT-AND-TUNING.md`): named presets, clone, edit, select-at-boot, swap-without-rebuild.
- In-app tuning panel: sliders for Heat constants / Getaway curve / scoring; **embed the Monte Carlo** and show the run-length and win-rate distributions shifting live.
- Validate edited presets before they can be selected.

**Acceptance gate:** edit a preset's Heat constants in-app, see the distribution charts update, save it as a new preset, and play a run on it — all without a rebuild; invalid presets are rejected with a clear message.

---

## E12 — True-offline build (optional)

**Goal:** run with zero dev server.

**Stories**
- Service worker / static `file://`-friendly build so the app double-clicks to play offline.

**Acceptance gate:** built artifact runs fully offline with no `localhost` server; all features intact.

---

## E13 — GM Console & player-view redesign (cockpit) *(depends: E5–E10)*

**Goal:** replace the original screens (built against a faulty layout) with a single **cockpit** GM
console — persistent meters/crew/launchers around the edges, one calm work stage in the middle, no
document scroll — plus a reworked mini-game lifecycle, a new spoils/wrap-up beat, and a clean overlay
system. **Supersedes E10's visual pass.** The design is produced in **Claude Design web** from
`docs/FRONTEND-REDESIGN-BRIEF.md` and lands in **`design-system/redesign/`** (the screen set +
variants is the input spec — see `design-system/redesign/README.md`); the design system
(`design-system/`) stays the source of truth — do not invent tokens, colours or type. This is a
**presentation/IA** epic: do not change engine rules, the `MiniGame` contract shape, content/presets,
or the design tokens. If a screen genuinely needs one of those touched, **`PIPELINE_BLOCKED`** rather
than fork it.

**Stories**
- **Cockpit shell.** Viewport-locked layout that never scrolls the page: top rail = meters (Heat
  track hero + Loot + phase/room), left rail = crew, right rail = tool launchers + Undo, bottom =
  action bar (primary CTA + contextual sound cues), centre = the work stage with a fixed-height
  teleprompter strip. Over-full regions scroll **internally** with an edge fade — never the document.
  Build each phase stage (Setup, Briefing, Obstacle, Scenario, Offer, Getaway, Result) into it.
- **Crew rail + crew-detail popover.** Bigger, legible avatars (four lane stats, power-up pips,
  exhaustion). Click → a popover that is also the **per-player override** surface (stats ±/set, the
  four power-up toggles, rest, gear held, rename). The rail doubles as the **commit** surface
  (obstacles) and **attempter-picker** (scenario rolls). This decentralises the old monolithic
  override panel.
- **Overlay system.** Drawers (full Soundboard; run-level GM Overrides — Heat/Loot/Room/Phase),
  popovers (crew detail, gear-assign target, commit, dial info), dialogs (Settings, confirm-destructive,
  reopened gear assignment). Nothing dense is permanently mounted; **Undo** stays a first-class
  persistent button.
- **Universal mini-game shell + START.** One shared three-state lifecycle wrapping every game:
  **ARMED** (script + GM-only `DialReadout` + static setup + boosts-available + a big **`START`**;
  the clock does **not** run on load) → **ACTIVE** (visible mode/state via colour, progress as a
  meter, boosts that fire once then disable, **no layout shift** on boost/state change) → **RESOLVE**
  (`OutcomeJudge`, suggested tier pre-set, GM confirms — app never overrides). Standard zones:
  status / challenge / referee. Rework all ten game components (+ solo/negotiated variants) into it,
  fixing the per-game presentation faults (text-only state, unreadable card affordances, cryptic
  feedback) per the brief. Soundboard quick-cues live in the action bar; the full board is a drawer.
- **Spoils / Wrap-up stage (new).** After every obstacle (and rewarding scenario): name the outcome +
  sting, announce Loot/Gear dropped, and **share gear out in the moment** (drag a dropped card onto a
  crew member; tap-card→tap-crew accessible equivalent; lane-of-choice boosts pick a lane), show who
  **rests next room**, then `CONTINUE`. **Delete the persistent gear tray entirely**; gear left
  unassigned re-opens via a badged Gear launcher (no dead-ends).
- **Getaway declutter.** Clock as hero, compact horizontal round bar (target · cleared meter ·
  clue-giver), clear action row, START-to-begin; optional player-view countdown mirror.
- **Player-view.** Redraw from `design-system/ui_kits/player-view/`: Defuse rulebook + Getaway
  countdown. Isolated, read-only, leaks no GM state.

**Acceptance gate:** the app is a single cockpit screen and **the document never scrolls** (only
over-full regions scroll internally); the edges show Heat + Loot + phase/room + crew at all times and
controls open as drawers/popovers/dialogs that are summoned and dismissed; **every timed mini-game
arms and waits for `START`** (none auto-run on load); after every room/scenario a **Spoils/Wrap-up**
beat announces Loot/Gear and lets the GM share gear out in the moment, and **there is no persistent
gear tray**; mini-game screens read at a glance (visible mode/state, meter progress, no layout shift
on boosts, clear card affordances, standard status/challenge/referee zones); **no dead-ends** — Heat,
Loot, stats, power-ups, exhaustion, outcome and phase are all GM-editable and `Undo` is always one
tap; the player-view leaks no GM state; tokens, type, colour-semantics, iconography and the two voices
match the design system and verify against `design-system/preview/*`; the design reviewer approves
against the Claude Design screen set; and `npm run check:full` passes.

---

## E14 — Reward economy: real-haul Loot, Gear every room, sell-don't-use *(depends: E13)*

**Goal:** make rewards *feel* like a heist. Loot reads as a dramatic haul, **most rooms put Gear on
the table**, and the crew can **decline a piece of Gear to bank more Loot instead** — turning the
build into a live, recurring decision. Fixes the two biggest fun-killers from the playtest: "the
numbers are tiny (4, not £thousands)" and "I never got offered gear."

> **Authorised to change engine + presets + content.** Implements design-doc **v0.9 §1–2** (already
> permitted by the doc: obstacle reward is "Loot, Gear, or both"). Supersedes E13's "don't touch
> engine/content" freeze for this scope.

**Stories**
- **Loot magnitudes → real money.** Re-scale every Loot source in `presets/default` so a run banks
  figures on the order of the redesigns (`$25k`, `$45k`, `$53k`, `$137k`, `$186k`): obstacle option
  `reward`s (`presets/default/content/roomTemplates.json`), `tuning.json` `outcomeLoot.*`, and
  scenario `lootDelta`s (`presets/default/content/scenarios.json`). These stay **preset data** — no
  magnitude is hardcoded in the engine. Standardise the currency symbol on **`$`** (the redesign set
  uses `$`; the design-doc `£` flavour is superseded for display).
- **Central Loot formatter.** One helper (e.g. `formatLoot(n)` in the engine/content layer) producing
  `$0`, `$5.6k`, `$53k`, `$1.2m` exactly as the mockups show (`design-system/redesign/0 - Cockpit
  Shell.html`, `6 - Spoils.html`, `9 - Result.html`). Replace the raw `.toLocaleString()` in
  `src/console/shell/TopRail.tsx:100` and every other Loot readout (Spoils, Offer, Result,
  Setup/leaderboard, GM Overrides) with it. Engine stores integers; formatting is a display concern.
- **Gear on most rooms.** Extend the obstacle-option schema + `roomTemplates.json` so options carry a
  **Gear reward descriptor** as well as / instead of Loot — supporting the three reward shapes the
  redesign shows on `3 - Obstacle Room.html`: **Loot only** (`$30k`), **Loot + Gear** (`$45k + Gear`),
  **Gear only**. Tune generation so **gear appears in the majority of rooms** (current state: obstacles
  grant Loot only — gear came solely from scenarios, which is why the playtester never saw it). Reuse
  the existing gear descriptor model from `src/engine/scenario.ts` (powerUp / statBoost / bigScore;
  lane-of-choice carried unresolved).
- **Sell-don't-use decision.** When a reward includes Gear, the crew may **decline the gear and bank
  extra Loot instead**. Add the engine event + the choice surface in the **Spoils/Wrap-up** beat
  (`src/console/screens/Spoils.tsx`) per `6 - Spoils.html` — each unassigned gear card can be assigned
  to a crew member *or* "sold" for its Loot value. The Loot-instead value is preset data
  (`gearSellValue` curve, e.g. scaling with run depth). Undoable like every mutation.
- **Balance.** Re-tune so `npm run sim:check` still asserts the design bands (median ~4–5 obstacles,
  win-rate by skill, Loot roughly doubles poor→good) **at the new magnitudes**; update the harness's
  numeric expectations and the design targets it asserts.

**Acceptance gate:** a played run banks dramatic figures rendered via the shared formatter
(`$3.6k`/`$137k`, never `4`) everywhere Loot appears; **most rooms offer Gear** and a full run reliably
puts several gear cards in front of the crew; declining a gear card banks extra Loot instead, and the
choice is undoable; the gear descriptor still resolves through the existing assign flow with no
dead-end; `npm run sim:check` and `npm run check:full` pass with the re-tuned preset.

---

## E15 — Heat-scaled difficulty & loot progression *(depends: E14)*

**Goal:** make the push-your-luck curve *bite*. Early rooms are forgiving and thin; as Heat climbs (and
the run deepens) games get harder and the Loot/Gear on offer gets richer — so pushing your luck means
**harder games for bigger numbers**, and a crew that hasn't levelled the relevant lanes can no longer
stay clean late. Today, mini-game difficulty depends **only** on committed crew lane ratings
(`src/engine/scaling.ts` `computeDial`) and Loot is flat; only the Getaway rides Heat.

> **Authorised to change engine + presets + balance targets.** Implements design-doc **v0.9 §3** (new
> numbers note added to the doc). This is a genuine balance change — treat the sim harness as the gate.

**Stories**
- **Heat/depth term in the dial.** Add a Heat-and-depth contribution to the obstacle difficulty dial
  and the scenario DC, *on top of* the existing stat dial, all driven by **preset curves** (no
  hardcoded constants). Cool/early ⇒ easier; hot/deep ⇒ harder. Keep the GM-only `DialReadout`
  honest (it must reflect the combined dial).
- **Reward scales with Heat/depth.** The Loot (and gear richness) on offer per option rises with
  Heat/room index, so the late-run greedy door is genuinely tempting — wire this through the E14
  reward fields as preset curves.
- **Levelling matters late.** Ensure the tuning makes "clean" outcomes in late rooms realistically
  require lane investment (stat boosts / power-ups), so the build decisions from E14 pay off — verify
  via the sim that an un-levelled crew's late-room clean-rate falls off while a levelled crew holds up.
- **Balance harness.** Extend `npm run sim:check` to assert the new shape: early-room clean-rate high,
  late-room clean-rate Heat/level-dependent, run-length band still within the design target (~4–5
  obstacles median, >10 rooms still rare). Re-assert win-rate-by-skill ordering.

**Acceptance gate:** with the default preset, the `DialReadout` visibly hardens as Heat rises and the
Loot on offer grows with it; the sim shows early rooms forgiving and late rooms punishing, an
un-levelled crew degrading late while a levelled crew sustains, and **all existing design bands still
hold**; `npm run sim:check` and `npm run check:full` pass.

---

## E16 — Crew identity, Setup & Result *(depends: E13; leaderboard schema bump)*

**Goal:** the run has a **named crew**, Setup matches `1 - Setup.html`, and Result matches
`9 - Result.html`. Fixes: no team name; the setup checklist (wrong, remove it); free-text quirks
instead of the designed stat-combo quirks; dice mode not chosen at Setup; the leaderboard not showing
team name / banking cash correctly; a thin Result page.

> **Authorised to change engine + content + the persisted leaderboard schema** (version bump + Zod
> migration; stale/garbled save fails loud per the E3 store rule).

**Stories**
- **Crew/team name.** Add a persisted crew name to run + save + leaderboard state. Setup field
  (placeholder e.g. *"The Magpies"*); shown in the top rail context, Result, the leaderboard, and the
  confirm-abandon dialog (`10 - Overlays.html` §14). `src/console/screens/Setup.tsx`,
  `src/platform/persistence/leaderboard.ts`.
- **Starting quirks = named stat combos.** Replace the free-text `quirk` with a fixed, named quirk
  table in content (`presets/default`): each quirk is either **+2 to one lane** or **+1 to two
  different lanes** — i.e. 4 single-lane + 6 two-lane = **10 named quirks** (name every combo, heist
  flavour, e.g. *"Grease Monkey" → +1 TEC* as shown on `1 - Setup.html`; design the full set). Setup
  renders a per-player quirk **dropdown** (not a free text field), and the chosen quirk applies its
  boosts to starting stats. Drop the old "optional quirks" notion (design-doc line 43 says every
  player starts with one).
- **Remove the setup checklist.** Delete `SETUP_CHECKLIST` and its UI (`Setup.tsx:9-14`) — it's not
  part of the design.
- **Dice mode at Setup.** Surface the dice-mode setting (App roll / Physical die) in Setup's advanced
  disclosure per `1 - Setup.html` (and keep it in Settings). Persisted, default app-roll (E7 already
  owns the engine semantics — this is the Setup-screen surface).
- **Resume / new + leaderboard panel.** Build Setup's **Resume · <crew name>** vs **Start a new job**
  cards and the **Personal best** panel exactly per `1 - Setup.html` (rank · team · score · Heat).
- **Leaderboard correctness.** Fix the entry to store **team name** and the **actual cash banked**, and
  render score via the E14 formatter — the playtest showed cash displaying wrong and no team name.
- **Result page.** Rebuild `src/console/screens/Result.tsx` to `9 - Result.html`: win/bust verdict, the
  **score equation** (Loot banked × Heat multiplier = final score, with the "stayed cool / maxed out"
  reason line), the leaderboard placement panel ("New best · #2" / "Did not place"), run-summary
  affordance, and **Go again**.

**Acceptance gate:** Setup takes a crew name, offers the 10 named stat-combo quirks via dropdown, sets
dice mode, has **no checklist**, and shows Resume/new + a leaderboard panel matching the mockup; a
finished run writes its **team name + banked cash** to the leaderboard and they render correctly there
and on a redesigned Result page (verdict + score equation + placement + Go again); the schema bump
migrates or loud-fails old saves; `npm run check:full` passes and the design reviewer approves vs
`1 - Setup.html` / `9 - Result.html`.

---

## E17 — The coherent heist script (narration + Briefing) *(depends: E13)*

**Goal:** the teleprompter reads as **one coherent heist** from briefing to getaway — a procedurally
generated through-line **per mark** that sets the scene before each room and pays it off after, ties
rooms together, and never repeats or goes vague. The current director picks an independent variant
per beat with no continuity (`src/console/teleprompter/director.ts`,
`src/content/narration/select.ts`); the "Next" button's behaviour is unclear. The Briefing also still
carries an order-of-play/mastermind box the design explicitly rejects.

> **Authorised to change content + the narration director.** Large content-authoring epic. Stays
> deterministic under seed (golden rule 4) and non-repeating (E8 selector property).

**Stories**
- **A scripted through-line per mark.** At run start, the narration system commits a **per-mark spine**
  (the mansion/mark, its dressing, the vault, the stakes) seeded off the run RNG, and threads it
  through every beat so callbacks and continuity hold — not isolated one-liners. Heavy **templating**
  (mark name, room type/lane, committed crew, outcome, Heat band, run total) fills a **large** bank so
  each run feels bespoke. Design the schema/templating in `docs/` if it extends the E8 model.
- **Scene-set then reveal, per room.** Each room gets a beat **as the crew is about to enter** (set the
  scene / the choice ahead) and a separate beat **on the reveal** (what the choice/outcome meant) — wire
  these to the Obstacle, Scenario and Spoils stages so the prompter narrates entry → tension → payoff.
- **"Next" semantics.** The **Next** button advances through the *multiple scripted lines of the
  current beat* (and only appears when there is a next line) — it does **not** regenerate/re-roll the
  line. Fix `src/console/teleprompter/Teleprompter.tsx` + the screens that drive it.
- **Briefing screen.** Remove the **Order of Play / Mastermind** panel entirely (`Briefing.tsx:70-92`;
  design doc: "no fixed turn order"); give the freed space to the teleprompter and the dossier/"every
  room pays out" framing per `2 - Briefing.html`.
- **Bank size + no-repeat.** Author enough variants/templates that a full run never repeats a line and
  the mood stays consistent; keep the deterministic, recent-avoiding selector from E8.

**Acceptance gate:** a full seeded run reads as a continuous heist — briefing establishes the mark,
each room is scene-set on entry and paid off on reveal, lines tie together and never repeat; **Next**
only steps within a beat's scripted lines (never regenerates); the Briefing has **no turn-order/
mastermind box** and a roomier teleprompter; output is deterministic under seed; `npm run check:full`
passes and the design reviewer approves vs `2 - Briefing.html`.

---

## E18 — Mini-game fidelity, full-team games & judging fixes *(depends: E13)*

**Goal:** the ten games look and play like `5 - Mini-games.html` / `5b` / `5c` — clear instructions on
ARM, every control wired, glanceable ACTIVE state, honest RESOLVE — plus **full-team games** (no crew
select, no resting) where the design calls for them, and the judging bugs fixed. The playtest found the
games "totally unbuilt for designs," a Categories mis-judge, and confusion over boost naming.

> **Presentation + per-game logic fidelity, plus the power-up model fix.** May change `MiniGame`
> *component* internals, generators and judges, and **the boost model** (see the boost story —
> one ability per game, any-relevant-lane trigger; this may touch the contract's boost shape). Keep the
> rest of the `MiniGame` contract stable; for any *other* contract change, `PIPELINE_BLOCKED`. Boosts/
> lanes/judging stay aligned to design-doc **v0.9** §"The ten games".

**Stories**
- **Per-game redraw to the mockups.** Rework each of the ten game components (+ solo/negotiated
  variants) in `src/minigames/games/*` to its specific `5b`/`5c` panel: Crack the Tumblers (ascending
  pins + clash), Beat 16 (beat dots + tap + on-beat feedback), Categories (hero category + tally),
  The Once-Over (study→identify, changed-card flag), Follow the Circuit (Simon grid watch→repeat),
  Inside Knowledge (Q + GM-only answer + correct/wrong + narrow-it-down variant), Safe-Crack
  (Mastermind pegs + stethoscope reveal), Assembly Line (sets tally + tip-off types strip), Steady
  Hands (tower meter + burst secondary clock), Defuse the Alarm (the cards-are-wires device + GM-only
  resolution + tripped/forgiven). Standard status/challenge/referee zones, meter progress (not raw
  counts), **no layout shift** when boosts fire.
- **Clear instructions on ARM + working buttons.** Every game's **ARMED** state shows a short, concrete
  how-to-play and the GM-only `DialReadout`; the clock does not run until **START**; every button the
  mockup shows (tally `+1`, tap, correct/wrong, boost, undo) is wired and does what it says.
- **One power-up ability per game (model fix).** Per the corrected design (doc **v0.9 §5**): each game
  has **exactly one** signature ability, and a committed player may shout it once if they hold a
  power-up in **any lane the game uses** — *not* a different effect per lane. **Collapse every combo
  game's old dual boost to its single ability** and retire the dropped ones: Crack the Tumblers =
  **Reset Pin**, Beat 16 = **In the Bones**, Categories = **Skip**, The Once-Over = **Hunch**, Follow
  the Circuit = **Photographic**, Inside Knowledge = **Narrow It Down**, Safe-Crack = **Stethoscope**,
  Assembly Line = **Tip-Off**, Steady Hands = **Extra Hands**, Defuse the Alarm = **Clear Channel**.
  *Retired (must be removed from content/code): Muscle Memory, Cheat Sheet, Patient Touch, Quick Hands,
  **Steady Breath**, Spare Wire.* Update the gear/boost data, the boost-eligibility logic (fire when the
  holder has a power-up in any of the game's lanes), and the ARMED/ACTIVE boost UI so it reads as the
  game's one shout. **This is the one place the wave may adjust the `MiniGame` boost model** (data +
  eligibility); if the contract *shape* must change, do it here rather than `PIPELINE_BLOCKED`, but keep
  the rest of the contract stable. ⚠ **The `5b`/`5c` mockups and `FRONTEND-REDESIGN-BRIEF.md` predate
  this fix and still show two boosts per combo game — follow design doc v0.9 (one ability), not the
  mockups, for boosts only.** Update tests that assert the retired boosts.
- **Full-team games.** Add a `fullTeam` capability: such games take the **whole crew**, show **no
  crew-select** and impose **no resting** next room. Decide and document which games are full-team —
  the "confer as a table" games are the natural fit (**Categories, Inside Knowledge, Assembly Line**;
  confirm against the mockups and `docs/MINIGAMES.md`). Wire commit/exhaustion to skip selection and
  rotation for these, and update `docs/MINIGAMES.md` + scaling presets accordingly.
- **Categories judging fix.** `src/minigames/games/categories/judge.ts:24-29` returns *complication*
  whenever the timer expired even though the target count was met — the playtest hit this with more than
  the target recorded. Re-derive the tiers to the design intent (**met the count = clean**;
  *complication* = scraped/late-but-short by a small margin; *botched* = missed), and add a unit test
  for "target met, then timer expires ⇒ clean". Audit the other judges for the same timer-overrides-met
  pattern.

**Acceptance gate:** all ten games (and variants) render their `5b`/`5c` panels with on-ARM
instructions, wired controls, meter progress and no boost-time layout shift; the designated **full-team
games run with no crew-select and no resting**, others keep commit + rotation; **Categories returns
clean when the count is met before/at expiry** (unit-tested), and no judge downgrades a met target;
boosts read as their lane power-up (Steady Breath retained); `npm run check:full` passes and both the
design and game-design reviewers approve vs the mockups.

---

## E19 — Room fidelity: Obstacle commit, Scenario roll reveal, Spoils + cockpit polish *(depends: E13; Spoils gear-share lands on E14)*

**Goal:** the Obstacle, Scenario and Spoils stages match `3`/`4`/`6 - *.html`, the scenario roll is
**dramatic and legible**, and the cockpit shell stops blocking content. Fixes: the "undesigned" crew
commit; obstacle options not showing Gear; a flat roll that prints `lootgained2` and seemingly grants
nothing; the action bar covering the bottom of the stage; crew cards not matching the design.

> **Mostly presentation/IA; one bug-fix may touch the scenario reducer's result reporting.** The
> Gear-on-obstacle *rewards* themselves come from **E14** — this epic renders and commits them.

**Stories**
- **Obstacle option cards.** Render each option with its tag (safe/high-risk), lane chip + game name,
  description, and the **Reward (Loot / Loot+Gear / Gear) and Heat** rows per `3 - Obstacle Room.html`,
  reading the E14 reward fields. Show the GM-only difficulty dial on the selected door.
- **Tap-crew commit.** Replace the current commit mechanism (`crewRailMode` multi-select) with the
  designed flow: after choosing a door, **tap crew on the left rail** to commit them (GOING / PICK /
  RESTS states), with the "Going in · N of M" chip row and min/max enforcement, per `3 - Obstacle
  Room.html`. The same rail is the **attempter-picker** for scenario rolls (`4 - Scenario Room.html`).
  (Full-team games from E18 skip this and send the whole crew.)
- **Dramatic, honest roll reveal.** Rebuild the scenario roll (`src/console/screens/ScenarioRoom.tsx`
  `RollReveal`) to `4 - Scenario Room.html`: show the full maths as a **DC-derivation row** (base
  difficulty − attempter rating + heat → DC, all four §10.3 items) plus a **`d20 vs DC` / "need N+"**
  comparison row and odds bar **before** the roll, then **roll with drama** and **show the actual d20
  value**, the **raw roll vs DC** result, the **clean/complication/botched result** (matching the engine
  verdict in every Heat state — never double-count the lane rating into the comparison), and **exactly
  what was gained** (Loot via
  the E14 formatter, Heat, Gear). Kill the cryptic `lootgained2` text and **verify the Loot is actually
  applied** (`src/engine/reduce.ts` RESOLVE_SCENARIO_ROLL ~167-220 grants it but it was never revealed,
  and some choices may have `lootDelta:0` — surface the real outcome and confirm the grant).
  **Blind gamble — reveal only after commit.** A Scenario's hidden effect stays concealed until the
  crew commits the choice: blind A/B cards → commit → reveal (roll maths/roll/result, or the no-roll
  effect panel) → Continue → Spoils. **Do not show the effect pre-commit and do not add any
  "Back"/peek-then-switch affordance** — that breaks the gamble. The design docs
  (`heist-game-design.md`, `the-job-app-design.md` §10.3) are authoritative here **over** the
  `4 - Scenario Room.html` `04e` panel, which is the *post*-commit reveal screen, not a pre-commit peek.
- **Spoils / Wrap-up.** Bring the stage up to `6 - Spoils.html`: outcome banner + sting, **Loot banked
  + run total**, the **gear-share panel** (per-card assign dropdown, lane-of-choice picker for
  lane-of-choice boosts, the E14 **sell-for-Loot** option), and the **rests-next-room** bar. Unassigned
  gear re-opens via the badged Gear launcher as the `6d` dialog (no dead-ends). Adopt the redesign's
  "interesting" spoils framing (run-total, per-card flavour) the playtester called out.
- **Cockpit polish.** Fix the action bar so it **no longer blocks the bottom of `.stage-inner`**
  (`src/console/shell/cockpit.css`, `Cockpit.tsx`) — over-full stage regions scroll internally with an
  edge fade, never under the bar; move the primary/secondary CTAs into the action bar and reserve its
  centre for **contextual sound cues** per `0 - Cockpit Shell.html` (the cues themselves are wired in
  E20). Redraw the crew cards to the `design-system/preview/comp-crew.html` specimen (the "diamonds"/
  pip + lane-stat layout the playtester flagged).

**Acceptance gate:** obstacle options show Loot/Gear/Heat and commit by **tapping crew on the rail**
(min/max honoured); the scenario roll plays dramatically and shows the **rolled value, result, and the
Loot/Heat/Gear actually gained** (no `lootgained2`, grant verified); the Spoils stage matches
`6 - Spoils.html` including gear-share + sell-for-Loot + rests bar with no dead-end; the action bar
never covers stage content and the crew cards match the specimen; `npm run check:full` passes and the
design reviewer approves vs `3`/`4`/`6 - *.html`.

---

## E20 — Getaway rework & audio that works *(depends: E13)*

**Goal:** the finale matches `8 - Getaway.html` with the **new ditch rule**, and the **soundboard
actually makes sound** — including the contextual cues in the action bar and a Getaway that's audible.
Fixes: ditch raises Heat / buy-seconds exists (both wrong now); audio triggers do nothing (no asset
files exist); the Getaway is silent.

> **Authorised to change engine + presets + add binary audio assets.** Implements design-doc **v0.9 §4**
> (ditch drops Loot, buy-seconds removed — doc already revised). Audio assets must be **offline-bundled
> and openly licensed** (golden rule: no CDN at runtime).

**Stories**
- **Ditch drops Loot, not Heat.** Change `GETAWAY_DITCH` (`src/engine/reduce.ts:254-257`,
  `src/engine/getaway.ts`) so ditching a card **forfeits some banked Loot** (preset `ditchLootCost`)
  and skips the card, with **no Heat change**. **Remove buy-seconds** entirely (`Getaway.tsx`
  `handleBuySeconds`, the `getaway.buySecondsBonus` tuning). Keep power-up **skips** (one per power-up)
  as the free skip per `8 - Getaway.html`.
- **Getaway declutter + states.** Ensure the screen matches `8 - Getaway.html`: hero clock, compact
  round bar (target · cleared meter · skips left · clue-giver), ARMED→ACTIVE→near-bust states, clear
  Cleared / Skip / Ditch action row.
- **Source real audio assets (open-licence).** The sound manifest (`presets/default/content/sound.json`)
  references files that **don't exist** (`public/` has none) — that's why nothing plays. Source
  **CC0 / openly-licensed** clips for each cue (ambient drone, heartbeat, ticking clock, lock click,
  footsteps, wire snip, stings clean/complication/botch, cha-ching, gear chime, alarm/siren, finale
  engine/tyres, win/bust) from CC0 libraries (e.g. freesound.org CC0, mixkit, kenney.nl, Sonniss GDC
  bundle), convert to web-friendly `.ogg`/`.mp3`/`.wav`, place under `public/sound/` to match the
  manifest paths, and record provenance/licence in a `CREDITS`/`docs` note. Keep the manifest as preset
  data.
- **Wire the soundboard + action-bar cues.** Verify `src/platform/audio/engine.ts` actually loads and
  plays the now-present assets; the full board (`10 - Overlays.html` §10 drawer) and the **contextual
  cues in the bottom action bar** (`0 - Cockpit Shell.html`) trigger the right cues per phase, with the
  ambient bed nudged by Heat (drone → heartbeat). Surface a clear failure if a cue asset is missing
  (don't silently no-op).
- **Getaway audio.** The Getaway plays sound — start cue, ticking that tightens with the clock, and a
  win/bust sting on resolve (the playtester asked for the getaway to "make a noise too").

**Acceptance gate:** ditching in the Getaway **drops Loot and leaves Heat unchanged**, buy-seconds is
gone, power-up skips remain, and the screen matches `8 - Getaway.html`; the soundboard and the action
bar's contextual cues **produce audible sound from bundled, openly-licensed assets** (no CDN, licences
recorded), the ambient bed responds to Heat, and the Getaway is audible (start/tick/win-bust);
`npm run check:full` passes and the design reviewer approves vs `8 - Getaway.html`.

---

## Cross-cutting requirements (apply to every epic)

- **No dead-ends / GM override** (E2 surface) must be honoured by any new state a later epic introduces.
- **Everything tunable is preset data**, never a hardcoded constant.
- **Determinism:** new randomness draws from the run RNG.
- **Player-view isolation:** never leak GM-only state to the player surface.
- **Tests + balance + content validation** stay green (`npm run check:full`).
