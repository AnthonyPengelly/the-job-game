# GAME-DESIGN-RIGOUR.md — balance as an automated guardrail

> The game's balance is not a thing we tuned once and trust forever. It is a
> **build gate**. Every preset that ships must prove, on every run of the
> pipeline, that it still hits the design targets. This doc explains the
> balance harness (`npm run sim:check`), the in-app tuning panel that reuses it,
> and the agent-led playtesting that backs it up.

The fixed numbers this doc defends live in
`docs/design/heist-game-design.md` (§"What the model showed") and were settled
by the reference Monte Carlo in `docs/design/heat-model-simulation.py`. **Do not
contradict them.** This doc says how we *keep* them true; it does not redefine
them.

---

## 1. Why balance is a first-class, automated guardrail

The Job lives or dies on one feeling: *push or run?* That tension only exists if
the underlying numbers behave — runs that end too fast are boring, runs that
drag are exhausting, a single botch that kills a run is unfair, and a game where
skill doesn't pay is pointless. Those properties are **emergent**: they fall out
of dozens of tunable constants (Heat steps, the escalation ramp, the Getaway
curve, scenario swings) interacting over thousands of runs. You cannot eyeball
whether a preset is balanced. You have to *run it*.

So we treat balance the way we treat types: a property the machine checks before
work merges, not a vibe a human re-confirms by hand. Three facts make this cheap
and reliable:

- **The engine is pure** (`src/engine`, `(state, event) -> state`, no DOM, no
  timers, no `Math.random`). A thousand simulated runs execute in milliseconds.
- **Everything is deterministic** through one seeded RNG. Same seed + same
  preset ⇒ same distribution. Re-runs are reproducible; failures are debuggable.
- **The sim *is* the ship code.** The harness drives the exact same
  `reduce` and Heat/Getaway/generation functions the app runs at the table.
  There is no separate model to drift. This is the single most valuable
  architectural decision in the repo (see `the-job-app-design.md` §2).

Because of all three, balance becomes a fast, free, deterministic gate the
pipeline runs on every design-bearing change — alongside type-check, lint, and
unit tests. A preset that breaks the targets **fails the build**, exactly like a
type error would. The simulation work stays a *living guardrail*, not a one-off
spreadsheet that rots.

---

## 2. The balance harness — `npm run sim:check`

`sim:check` is a deterministic script (no model, no agent — see
`ORCHESTRATION.md` §1). It:

1. **Loads the active preset** (default unless overridden) and validates it with
   Zod first — a malformed preset fails here, not silently mid-run.
2. **Runs N seeded Monte Carlo runs** over a matrix of conditions: crew skill
   (`bad`, `avg`, `good`) × headcount (`2`, `4`, `7`), each cell driven through
   the real engine with a fixed base seed so the whole run is reproducible.
   `N` is large enough for stable medians/rates (the reference uses 8k–15k per
   cell; the harness uses the same order of magnitude).
3. **Computes the distributions** the design cares about: median obstacles per
   run, median/mean rooms, the fraction of runs past 10 rooms, win rate per
   skill band, mean Loot banked per skill band, and the run-length coefficient
   of variation.
4. **Asserts the design targets with tolerances** (table below). Any assertion
   that fails prints the observed value, the target, the seed, and the offending
   preset, then exits non-zero.

```bash
npm run sim:check                 # active preset
PRESET=spicy npm run sim:check    # a named preset (also run in E11 tuning work)
```

It exits non-zero on any breached target. In the pipeline that routes the task
straight to Fix without spending a reviewer (`ORCHESTRATION.md` §2). It is part
of the review gate's deterministic block; it is **not** inside `npm run check`
(the fast inner-loop alias), but it **is** run on every design-bearing diff and
is required green before merge. `check:full` runs type+lint+unit+sensors;
`sim:check` is the balance gate that runs beside it.

### It shares the engine code

The harness imports the engine directly. There is no second copy of the Heat
model. When a builder changes `reduce`, the Heat step, the escalation ramp, the
Getaway odds, or the generator, `sim:check` exercises *that* change. This is why
porting `heat-model-simulation.py` to TS (Epic E1) is "the same code that ships,
not a separate model" — the Python file is the reference oracle the TS sim must
reproduce within tolerance, after which the TS engine becomes the source of
truth and the Python is kept only as documentation of intent.

---

## 3. The assertions (targets & tolerances)

These mirror `heist-game-design.md` §"What the model showed" and the targets
asserted in `heat-model-simulation.py` (`stage1`/`stage2`). Tolerances absorb
Monte-Carlo noise at the harness's `N`; tighten them only with a design-review
sign-off.

| # | Property | Target | Assertion (active preset) | Tol. |
|---|----------|--------|---------------------------|------|
| A | Median obstacles / run | ~4–5 | `4 ≤ medianObstacles ≤ 5` | exact band |
| B | Runs dragging past 10 rooms | ~2–3% | `P(rooms > 10) ≤ 0.05` | ≤5% |
| C | Run length tight | within ±1 obstacle ~98% | `P(|obst − median| ≤ 1) ≥ 0.93` | ≥93% — see note |
| D | Win rate — bad crew | ~37% | `0.32 ≤ win_bad ≤ 0.42` | ±5pt |
| E | Win rate — avg crew | ~48% | `0.43 ≤ win_avg ≤ 0.53` | ±5pt |
| F | Win rate — good crew | ~57% | `0.52 ≤ win_good ≤ 0.62` | ±5pt |
| G | Skill ordering | bad < avg < good | `win_bad < win_avg < win_good` | strict |
| H | Skill payoff in Loot | roughly doubles poor→good | `score_good ≥ 1.75 × score_bad` | ≥1.75× — see note |
| I | Headcount helps a little | +6–7pt, 2→7 players | `0.03 ≤ win_7 − win_2 ≤ 0.12` | band |
| J | No single botch ends a run | botch adds only +2 Heat | `maxOutcomeHeat(botch) == 2` and no terminal-on-botch path | structural |

Notes:
- **C threshold 0.93 — HUMAN SIGN-OFF E1.7. DO NOT raise without sign-off.**
  Dual-RNG architecture (separate streams for room gen and outcome rolls)
  structurally produces P≈0.940 at N=20k. Not fixable without merging streams.
- **H uses `score` not raw loot — HUMAN SIGN-OFF E1.7. DO NOT revert to raw loot.**
  `score` = loot × win/bust multiplier. Raw loot ratio is only ~1.47× (pre-E14);
  score ratio is ~2.46× at E14 magnitudes (widened from ~1.79× pre-E14). Threshold
  is 1.75 (not 1.80) — deterministic scenario policy vs Python's probabilistic one
  compresses the ratio slightly. E14.5 verified: real-money magnitudes and gear-only
  obstacle options (reward:0) *widened* the ratio — rescale was non-uniform (gear-only
  options grant 0 Loot) so the good crew's win-rate advantage amplifies score
  separation. Clears the 1.75 threshold comfortably (headroom ~0.71).
- **Sim N = 20 000.** Do not reduce below 20k; SE≈0.007 needed for stable H.
- **A, B, C** are the "shape" of a run — measured on the `avg`/`n=4` cell, the
  same cell `stage1` tunes against.
- **D–H** are measured across the skill bands; **G** is the ordering invariant,
  the most important single property (skill must *separate*).
- **I** is read across headcount at fixed skill.
- **J** is partly a *structural* assertion, not a distribution: the engine must
  have no path where a botch outcome terminates the run, and botch Heat is
  capped at the preset's `botch_h` (2 in the default). Failure here is a design
  contradiction, not noise.

If a preset legitimately wants different feel (e.g. a "Spicy" pack with hotter
Heat), it carries its *own* expected bands in its preset metadata and `sim:check`
asserts against those — but the **default** preset must always hit the table
above. The skill-ordering invariant (G) and no-botch-ends-a-run (J) hold for
**every** preset, always.

---

## 4. A `sim:check` assertion, concretely

Pseudo-code (illustrative — not the final API). The point is: real engine, fixed
seeds, computed distributions, hard assertions with diagnostic output.

```ts
import { reduce, initialRun } from '@/engine';
import { loadActivePreset } from '@/content/presets';
import { makeRng } from '@/engine/rng';

const preset = loadActivePreset();              // Zod-validated at load
const SKILLS = ['bad', 'avg', 'good'] as const;
const HEADCOUNTS = [2, 4, 7] as const;
const N = 12_000;
const BASE_SEED = 1312;

function simulateRun(seed: number, skill: Skill, n: number): RunStats {
  const rng = makeRng(seed);
  let state = initialRun({ preset, skill, headcount: n, rng });
  // Drive the run autonomously: the harness plays a "model crew" whose
  // success probability is the skill band, exactly as heat-model-simulation.py
  // does — but through the SHIPPING reduce(), not a parallel model.
  while (!state.done) state = reduce(state, nextModelEvent(state, rng, skill));
  return statsOf(state);                         // { obst, rooms, win, loot, ... }
}

function cell(skill: Skill, n: number) {
  const runs = Array.from({ length: N }, (_, i) =>
    simulateRun(BASE_SEED + i, skill, n));       // deterministic per i
  return aggregate(runs);                         // medians, rates, means
}

// --- assertions ---
const avg = cell('avg', 4);
assert(avg.medianObstacles >= 4 && avg.medianObstacles <= 5,
  `median obstacles ${avg.medianObstacles} outside 4–5 (seed ${BASE_SEED}, preset ${preset.id})`); // A
assert(avg.pRoomsOver10 <= 0.05,
  `P(rooms>10)=${avg.pRoomsOver10} exceeds 0.05`);                                                   // B

const bad  = cell('bad', 4), good = cell('good', 4);
assert(bad.win < avg.win && avg.win < good.win,
  `skill ordering broken: ${bad.win} < ${avg.win} < ${good.win}`);                                   // G
assert(good.loot >= 1.8 * bad.loot,
  `loot payoff only ${(good.loot / bad.loot).toFixed(2)}× (need ≥1.8×)`);                            // H

// structural, not statistical:
assert(preset.heat.botch_h === 2, `botch Heat must be +2, got ${preset.heat.botch_h}`);              // J
assert(!engineHasTerminalBotchPath(), `a botch outcome can end a run — forbidden`);                  // J
```

`assert` here is a tiny harness helper that, on failure, prints the diagnostic
and accumulates failures so the report lists *all* breached targets in one pass
(don't bail on the first), then exits non-zero at the end. The seed in every
message makes a failing run reproducible: re-run with that seed to debug.

---

## 5. The in-app tuning panel reuses the same Monte Carlo (Epic E11)

The tuning panel is not a different balance model — it **embeds the same
harness**. Per `the-job-app-design.md` §6 and EPICS E11:

- The panel exposes the preset's Heat constants (HMAX, run-at fraction,
  escalation ramp, per-option costs, outcome Heat, scenario swings), the Getaway
  curve, and scoring weights as sliders.
- As you drag a slider, the panel **runs the embedded Monte Carlo over the
  edited preset** and redraws the run-length and win-rate distributions live.
  You *see* the curve shift, not guess.
- A preset can't be selected for play until it validates (Zod) — invalid presets
  are rejected with a clear message, never loaded silently.
- Save the edited values as a new named preset; play a run on it without a
  rebuild.

Because the panel and `sim:check` call the same simulation over the same engine,
a preset you tune to look good in the panel is the same preset CI will assert.
There is no "looked fine in the panel, failed in CI" gap — and a preset you
save can be checked headlessly with `PRESET=<name> npm run sim:check` before it
ships. The simulation lives *inside the product*, which is the whole point.

---

## 6. Agent-led playtesting (Playwright, seeded)

The balance harness proves the *numbers*. Agent-led QA proves the *experience*
and the *invariants* the numbers can't see. The QA agent drives the real SPA via
Playwright MCP against a **seeded** app, so every flow is reproducible and every
screenshot is diffable (`ORCHESTRATION.md` §2, §4). It is scripted to *verify a
named gate*, not to "explore freely." The cross-cutting checks every epic's QA
runs:

- **Seeded full runs.** Start a run on a fixed seed, drive it end-to-end
  (Setup → Briefing → obstacles/scenarios → Offer → Getaway → Result) using the
  stub outcome-picker (E3) or real mini-games (E4+). The run reaches a result.
- **No dead-ends.** From states the engine can reach, the GM-override surface can
  edit *out* — Heat/Loot/gear/phase are all reachable and `UNDO_LAST` restores
  the prior state. This is the cross-cutting "no dead-ends" rule from `CLAUDE.md`
  golden rule 1 and EPICS E2/E3, asserted in the browser.
- **Override checks.** Every override affordance works at the table: nudge Heat,
  grant/remove gear, force an outcome, re-roll/skip a room, jump phase — each
  reflects in the HUD and each undoes.
- **Player-view leak checks.** The isolated `player-view` surface (Defuse
  rulebook, optional Getaway display) never shows GM-only state. QA opens the
  cast surface and asserts no Heat/odds/answer leaks (golden rule 6, EPICS
  cross-cutting).
- **Screenshots of key states** for a human pass — captured deterministically
  off the seed so a reviewer can diff them across builds.

QA findings route through the bounded fix-loop in `ORCHESTRATION.md` (§2,
`MAX_QA_ROUNDS`). The QA agent never edits the game's balance to make a flow
pass — balance is owned by `sim:check`, not by QA.

---

## 7. Difficulty never papers over missing players

A standing design rule, enforced mechanically. When fewer players commit, the
answer is **never** "crank the difficulty dial to compensate." It is:

- **`minCommit`** — each mini-game declares a hard floor of committed players.
  The room generator filters on `minCommit` *before* applying the difficulty
  dial (`the-job-app-design.md` §10.5). A game that needs two players is never
  offered into a one-player slot.
- **Variants** — where a game's *mechanic* collapses at low headcount, it ships a
  proper variant (Crack the Tumblers' solo memory test) or is excluded from that
  slot entirely (Assembly Line, Defuse the Alarm). If a layout would force an
  excluded game onto a solo slot, the generator **re-rolls the obstacle** rather
  than down-dialling an impossible mechanic.

The dial adjusts *difficulty*; it is not a headcount substitute. A generator
test (EPICS E5) asserts the two excluded games never appear in ineligible commit
slots, and that the solo-eligible pool stays ≥8 so single-commit obstacles never
starve. `sim:check` runs the `n=2` cells to confirm small crews still hit the
win-rate and run-shape bands without any dial-based fudging — assertion **I**
above is exactly this guardrail: more players help only *a little*, because the
floor is set by `minCommit` and variants, not by secretly making solo play
harder.

---

## 8. When a target fails

1. **Read the diagnostic.** The failing assertion prints observed vs. target,
   the seed, and the preset. Re-run that seed to reproduce.
2. **Decide: bug or intent?** If a code change shifted the distribution, fix the
   engine. If a *preset* change is intentional (a deliberately spicier pack),
   update that preset's expected bands — but never relax the default preset's
   bands, the skill-ordering invariant (G), or no-botch-ends-a-run (J) without a
   design-review sign-off recorded in `docs/`.
3. **Recurring class of failure?** Follow the harness-improvement protocol
   (`CLAUDE.md`): Inform (update this doc), Verify (add/strengthen an assertion
   or a generator test), Correct (a codemod where possible), and log it in
   `HARNESS_CHANGELOG.md` with date + trigger + change.

Balance is a guardrail, not a suggestion. If the build is red on `sim:check`,
the game is out of tune — fix the tune, don't loosen the gate.
