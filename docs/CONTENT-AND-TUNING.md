# CONTENT-AND-TUNING.md — presets as data

> The fixed principle (golden rule 3): **content, rules, tuning and scaling are
> data, not code.** They live in named **presets** under `presets/`, loaded at
> boot, swappable **without a rebuild**. The engine reads every tunable number
> from the active preset — nothing tunable is hardcoded. This is what makes
> playtesting cheap (clone a preset, tweak, try) and lets the balance harness
> (`npm run sim:check`) run any preset headlessly. See `docs/design/the-job-app-design.md` §10.6.

If a number could ever be retuned at the table, it is a preset field, not a
constant. A literal in `src/engine` for any value listed in the mapping table
below is a review failure.

---

## 1. The three pack types

A preset is one coherent bundle of three packs. The engine, the tuning panel
(E11) and the balance harness all consume the same bundle.

### Content packs — *what the run is made of*

Pure data, expanded without touching logic, authored across later epics:

| Pack | Built in | Holds |
|------|----------|-------|
| `scenarios` | E7 | The 44 scenarios: set-up, two choices, hidden effects, lane-weighted rolls, carried effects. |
| `gear` | E2 | The gear/power-up catalogue: lane, effect hooks, where it may be spent. |
| `narration` | E8 | Variant lines per beat (briefing, clues, option blurbs, push/run, the three outcome quips, scenario set-ups, Getaway intro/countdown, win/bust stings). |
| `banks` | E5 | Trivia question bank (Inside Knowledge) and category bank (Categories). |
| `sound` | E9 | The sound manifest: buffer ids → files, grouped by moment (ambient, SFX, stings, danger, finale). |
| `roomTemplates` | E1/E3 | Room/obstacle templates: which option menus the generator may draw (game · reward · Heat-cost shapes). |

### Tuning packs — *the rules numbers*

Everything the Monte Carlo treats as a `Config` knob:

- **Heat constants:** `hMax`, run-at fraction, escalation ramp (step + onset
  room), per-option Heat costs (safe/greedy), outcome Heat (clean/comp/botch),
  scenario swings (small/big).
- **Getaway curve:** the `frac**exp` falloff plus the crew-skill and headcount
  terms, and the clamp.
- **Scoring weights:** the win multiplier, the low-Heat style bonus, the bust
  multiplier.

### Scaling packs — *the 2–7 profiles*

The per-headcount profile the engine applies invisibly (`docs/design/heist-game-design.md`
"Scaling 2–7"):

- **exhaustion strength** — full rotation at 5–7, lighter at 4, a small "tired"
  penalty at 2–3.
- **crew-needed-per-option** — how many crew an obstacle option demands.
- **per-game commit floors & dial curves** — `minCommit` hard floors and the
  dial-from-headcount curve (difficulty never papers over a missing player —
  filter on `minCommit` first, then dial; see app-design §10.5).

---

## 2. On-disk layout

**One folder per preset** under `presets/`, named by its preset id. A folder
(not a single mega-file) keeps each pack independently diffable and lets the
loader validate pack-by-pack with a precise error path.

```
presets/
  README.md               ← the folder convention (this layout, in brief)
  default/                ← the shipped, balance-asserted preset
    _meta.json            ← name, version, description, content-pack references
    tuning.json           ← Heat constants · Getaway curve · scoring weights
    scaling.json          ← the 2–7 profiles + per-game minCommit floors
    content/              ← content packs (authored in E2/E5/E7/E8/E9)
      scenarios.json
      gear.json
      narration.json
      banks.json
      sound.json
      roomTemplates.json
  spicy/                  ← a clone of default with hotter Heat (worked example §7)
    _meta.json
    tuning.json
    scaling.json          ← may `"extends": "default"` to inherit unchanged packs
```

**Tuning, scaling and meta are always present.** Content packs may be omitted
from a derived preset; the loader then falls back to the base named in
`_meta.extends` (default: `"default"`). A preset that references a content pack
it neither ships nor inherits fails validation at boot — loudly, never silently
at the table.

JSON, not TS modules: presets must load without a rebuild (golden rule 3), and a
non-coder must be able to clone-and-tweak one. JSON has no comments — units and
intent live in a sibling `_meta.json` `units` block and in this doc, never in
the data file.

---

## 3. Selection at boot and swap at runtime

- **At boot:** the platform preset-loader reads `presets/<id>/`, validates it
  (Zod, §4), and hands the frozen preset object to the engine. The active id
  comes from (in order): an explicit argument (the balance harness, tests), the
  `?preset=` URL param, the persisted `lodge`-style `localStorage` setting, then
  `"default"`.
- **At runtime:** the GM picks another preset in the tuning panel (E11). The
  loader validates the new one, and only on success does the store swap it.
  Swapping mid-run is allowed but flagged — a new run is the clean path. **Never
  rebuild to change a number.**
- The engine receives the preset as an injected dependency (`reduce(state,
  event, preset)` via a bound context). It never imports a preset module — that
  would re-hardcode the data.

---

## 4. The Zod schema approach

Each pack has a Zod schema in `src/content/schema/` (`tuning.ts`, `scaling.ts`,
`meta.ts`, and one per content pack). A top-level `presetSchema` composes them.
**Parse at the boundary** (golden rule 7): nothing reads raw preset shapes — the
loader `presetSchema.parse()`s the bundle and downstream code consumes the
inferred type only.

`npm run content:validate`:

- discovers every folder under `presets/`,
- parses each pack against its schema,
- runs cross-pack invariants (every `roomTemplates` game id exists in the game
  registry; every scenario lane is one of the four; `minCommit` ∈ 1..7; the
  Getaway clamp brackets are ordered; `runAtFraction * hMax` is an integer Heat
  value; etc.),
- fails the build with the offending `presets/<id>/<pack>.json#/path` on any
  miss.

It runs in CI and is part of `npm run check:full`. A malformed preset can never
merge.

---

## 5. How the balance harness consumes a preset

`npm run sim:check` (the TS port of `heat-model-simulation.py`, golden rule 8)
takes a preset id (default `"default"`), builds the engine's `Config` **purely
from `tuning.json` + `scaling.json`** — the same numbers the shipped engine
reads — runs the headless Monte Carlo, and **asserts** the design targets:

- median ~4–5 obstacles,
- runs past 10 rooms ≤ ~3%,
- win-rate bands by skill (`bad < avg < good`),
- Loot roughly doubling poor→good crew.

Because the harness and the app read the *same* preset, the simulation can never
drift from what ships. A preset whose numbers break the targets fails
`sim:check` and cannot be the `default`. (Non-default presets may relax the
assertion via `_meta.assert: "off"` for deliberate "spicy/gentle" experiments —
they still must *validate*, they just aren't held to the default bands.)

---

## 6. Versioning & compatibility

- `_meta.version` is the **preset schema version** (currently `1`). The loader
  refuses a preset whose `version` is newer than the engine understands and
  migrates older ones through `src/content/migrations/` where a field moved.
- `_meta.contentVersion` (free-form, e.g. `"2026.06"`) tracks the *authoring*
  state of the content packs — bumped when scenarios/narration change, surfaced
  in the leaderboard so scores stay comparable within a content version.
- Adding a tuning field is a schema-version bump **with a default** so older
  presets still load. Removing or renaming one needs a migration. Never silently
  reinterpret an existing field.

---

## 7. Worked example — clone `default` → `spicy`, hotter Heat

1. Copy the folder:

   ```bash
   cp -r presets/default presets/spicy
   ```

2. Edit `presets/spicy/_meta.json`:

   ```json
   {
     "id": "spicy",
     "name": "Spicy (hotter Heat)",
     "version": 1,
     "description": "Default rules, faster Heat — greedier crews get punished sooner.",
     "extends": "default",
     "assert": "off"
   }
   ```

3. Trim `presets/spicy/` to just the packs you changed (`tuning.json`); delete
   `scaling.json` and `content/` so they inherit from `default` via `extends`.

4. Bump Heat in `presets/spicy/tuning.json` — e.g. escalation onset earlier and
   ramp steeper, greedy surcharge up:

   ```json
   "escalation": { "onsetRoom": 4, "rampPerObstacle": 0.3 },
   "obstacleHeat": { "safe": 1, "greedy": 3 }
   ```

5. Validate and balance-check:

   ```bash
   npm run content:validate
   npm run sim:check -- --preset spicy   # reports the shifted distributions
   ```

6. Select it: launch with `?preset=spicy`, or pick "Spicy (hotter Heat)" in the
   tuning panel. No rebuild.

---

## 8. Tunable → preset-field mapping

Every knob from `heat-model-simulation.py` `Config` and the design doc, and where
it lives in a preset. The harness builds `Config` straight from these fields.

| Design / sim knob | Sim symbol | Preset field | Default | Units |
|---|---|---|---|---|
| Heat track max (forced Getaway) | `HMAX` | `tuning.heat.hMax` | `20` | Heat points |
| Run-at (escape signal) fraction | `run_at_frac` | `tuning.heat.runAtFraction` | `0.55` | fraction of `hMax` (→ Heat 11) |
| Escalation ramp step | `ramp_step` | `tuning.escalation.rampPerObstacle` | `0.2` | extra Heat per obstacle·room |
| Escalation onset (room "a while") | (`int(room*ramp)`) | `tuning.escalation.onsetRoom` | `5` | room index |
| Base obstacle Heat (safe) | `base_ob` | `tuning.obstacleHeat.safe` | `1` | Heat per obstacle |
| Greedy surcharge | `greedy_x` | `tuning.obstacleHeat.greedy` | `2` | Heat (total greedy = safe+? → +2) |
| Greedy threshold | (`H < 0.5*HMAX`) | `tuning.obstacleHeat.greedyBelowFraction` | `0.5` | fraction of `hMax` |
| Outcome Heat — clean | (`+0`) | `tuning.outcomeHeat.clean` | `0` | Heat |
| Outcome Heat — complication | `comp_h` | `tuning.outcomeHeat.complication` | `1` | Heat |
| Outcome Heat — botched | `botch_h` | `tuning.outcomeHeat.botched` | `2` | Heat |
| Scenario swing — small | `scen_s` | `tuning.scenarioSwing.small` | `2` | ±Heat |
| Scenario swing — big | (`2*scen_s`) | `tuning.scenarioSwing.big` | `4` | ±Heat |
| Getaway curve exponent | `exp` | `tuning.getaway.exponent` | `1.3` | dimensionless |
| Getaway crew-skill term | (`(skill-0.65)*0.5`) | `tuning.getaway.skillTerm` | `0.5` | odds per skill unit |
| Getaway skill pivot | (`-0.65`) | `tuning.getaway.skillPivot` | `0.65` | skill fraction |
| Getaway headcount term | (`player_bonus*0.8`) | `tuning.getaway.headcountTerm` | `0.8` | odds multiplier on profile bonus |
| Getaway odds clamp | (`0.04..0.97`) | `tuning.getaway.clamp` | `[0.04, 0.97]` | probability bounds |
| Win score style multiplier | (`0.5*(1-H/HMAX)`) | `tuning.scoring.lowHeatStyleBonus` | `0.5` | Loot multiplier at Heat 0 |
| Bust score multiplier | (`*0.4`) | `tuning.scoring.bustMultiplier` | `0.4` | fraction of Loot |
| Per-headcount Getaway bonus | `player_bonus(n)` | `scaling.profiles[n].getawayBonus` | see `scaling.json` | odds bonus |
| Exhaustion strength | — (design) | `scaling.profiles[n].exhaustion` | `full`/`light`/`tired` | enum |
| Crew-needed-per-option | — (design) | `scaling.profiles[n].crewPerOption` | `[min,max]` | players |
| Per-game commit floor | `minCommit` | `scaling.minCommit[gameId]` | per game | players |
| Per-game dial curve | — (design) | `scaling.dialCurve[gameId]` | per game | curve params |

> The sim's `growth_bonus(i)` (early-room win ramp) and the `SKILL` crew-skill
> dictionary are **harness inputs**, not preset fields — they model the *crew*,
> not the *rules*. Keep them in the harness config, not in `tuning.json`.

---

## 9. Checklist for any preset change

- [ ] Edited the right `presets/<id>/*.json`, not a constant in `src/engine`.
- [ ] `npm run content:validate` green.
- [ ] `npm run sim:check` green for `default`; non-default presets at least
      validate and (if `assert: "on"`) hit the bands.
- [ ] New tuning field added with a default + schema-version bump (or a
      migration for a rename/removal).
- [ ] `_meta.json` updated (description, content-pack references, version).
