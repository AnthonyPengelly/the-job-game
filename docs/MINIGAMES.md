# MINIGAMES.md — The mini-game framework

> The ten mini-games are plugins behind **one** contract. This doc is the
> reference for that contract, the shared primitives, the dial, boosts,
> judging, and the per-game specs. It is the authority for Epics **E4**
> (framework + reference game) and **E5** (the ten games).
>
> The game design is fixed: `docs/design/heist-game-design.md` (the grid, the
> three principles, the ten games) and `docs/design/heist-content.md` (the
> per-game power-up effects). Do not contradict them — this doc implements
> them. Solo/scaling rules here reproduce `the-job-app-design.md §10.5`.

---

## 1. The contract

Every game is the same shape. One interface, ten implementations.

```ts
type Lane = 'tech' | 'physical' | 'charm' | 'stealth';
type Outcome = 'clean' | 'complication' | 'botched';

interface MiniGame<Params, ChallengeState> {
  id: GameId;
  lanes: Lane[];                                  // 1 lane, or 2 for combos
  generate(rng: RNG, dial: Difficulty): Params;   // procedural, fresh each run
  Component: React.FC<MiniGameProps<Params, ChallengeState>>;
  judge(state: ChallengeState, params: Params): Outcome;  // clean/comp/botch
  boosts: BoostHook[];                            // shouted plays for power-up holders
  minCommit: number;                              // hard floor on committed crew
  soloVariantId?: GameId;                         // separate game when solo needs one
}
```

Contract rules:

- **`generate` draws only from the passed `RNG`.** Same seed + same dial ⇒ same
  params. No `Math.random`. This is what makes runs replayable and tests
  deterministic (CLAUDE.md rule 4).
- **`generate` is pure data.** It returns `Params` — never React, never side
  effects. The `Component` renders from `Params` and owns `ChallengeState`.
- **`judge` is pure.** `(ChallengeState, Params) -> Outcome`. It is the app's
  *suggestion*; it never writes to the engine. The GM confirms (§5).
- **`Component` reports back via `MiniGameProps.onResolve(outcome)`** — and that
  outcome is whatever the GM confirmed through `OutcomeJudge`, which may differ
  from `judge`'s suggestion. The app never overrides the room.
- **`lanes` is the source of truth** for which boosts can surface and which
  committed crew supply the dial.

```ts
interface MiniGameProps<Params, ChallengeState> {
  params: Params;
  dial: Difficulty;
  committed: CommittedPlayer[];        // who's playing, with stats + power-ups
  onResolve: (outcome: Outcome) => void;   // fires once, after GM confirm
}
```

The engine imports nothing from here; the dependency runs
`engine → content → minigames → console/player-view` (CLAUDE.md). Mini-games
may read content banks (categories, trivia) but never reach upward into the
console.

---

## 2. The room loop: selecting and launching a game

The *room* dictates which games are possible; the crew chooses an option; the
**committed crew select the exact game** off the grid. The loop:

1. **Option chosen.** The obstacle's option names a lane requirement (one lane,
   or a combo). `CHOOSE_OPTION` carries the committed `PlayerId[]`.
2. **Resolve lanes → game.** Map committed lanes onto the grid in
   `heist-game-design.md`:
   - **One committed lane** (or all committed crew share a lane) → that lane's
     **single** game (the diagonal: Crack the Tumblers / Beat 16 / Categories /
     The Once-Over).
   - **Two *different* committed lanes** → the **combo** game at that
     intersection (Follow the Circuit, Inside Knowledge, Safe-Crack, Assembly
     Line, Steady Hands, Defuse the Alarm).
3. **Resolve variant.** Apply the `minCommit`/`soloVariant` rule (§7) for the
   committed headcount **before** the dial.
4. **Compute the dial** from the committed crew's lane rating(s) (§3).
5. **`generate(rng, dial)`** fresh params from the run's RNG stream.
6. **Mount `Component`.** The GM referees; `BoostButton`s surface for any
   committed power-up holder.
7. **`judge` suggests, GM confirms** via `OutcomeJudge`; `onResolve` feeds the
   engine (`RESOLVE_MINIGAME`).

The generator (in the engine, E1/E2) decides *which game a slot can offer* using
`minCommit` eligibility — see §7. The loop above is the *runtime* launch of an
already-chosen option.

---

## 3. The dial

The dial is the **passive** difficulty, set by the committed crew's lane
rating(s). Specialising turns it down; it is never used to compensate for a
missing player (that's `minCommit`'s job, §7).

```ts
interface Difficulty {
  level: number;        // normalised 0..n, lower = easier
  // resolved per-game into concrete levers below
}
```

**Mapping rating → difficulty.** Each committed player passively eases the game
in their committed lane. For a single-lane game, use the committed crew's lane
rating (highest, or sum, per the scaling preset). For a **combo**, all committed
lane ratings aggregate into a single scalar `dial.level` via `computeDial`
(sum-weighted by the `perLanePoint` preset field, never hardcoded — see
`docs/CONTENT-AND-TUNING.md`). The design calls for each lane to ease its own
half of difficulty (e.g. Safe-Crack: Tech → digit count, Stealth → guess count),
but the current implementation drives all levers from the same scalar — this is
the **accepted E4 trade-off**; per-lane differentiation can be added in a later
epic by threading per-lane levels through `Difficulty`.

The dial expresses itself through four levers (design doc, "Stats dial
difficulty"):

| Lever | Easier (high rating) | Harder (low rating) | Games it drives |
|-------|----------------------|---------------------|-----------------|
| **More time** | longer timer | shorter timer | Categories, Inside Knowledge, Defuse, Steady Hands, The Once-Over |
| **Fewer items** | fewer cards/digits/questions/wires | more | Crack the Tumblers, Safe-Crack, Inside Knowledge, Assembly Line, Defuse, The Once-Over |
| **Wider tolerance** | bigger gaps, more guesses, lower target | tighter | Crack the Tumblers, Safe-Crack, Categories, Steady Hands, Follow the Circuit |
| **Slower tempo** | slower playback / fewer beats | faster / more beats | Beat 16, Follow the Circuit |

The GM sees the resolved difficulty via **`DialReadout`** (GM-only). The crew
never sees it — they feel it.

---

## 4. The boost system

Each game has **one** signature ability (design v0.9). A committed player fires it if they
hold a power-up in **any** of the game's `lanes` — not a specific lane. This applies to combo
games (two lanes) and single-lane games alike: any lane power-up held is enough.

The six retired combo-game boosts (Muscle Memory, Cheat Sheet, Patient Touch, Quick Hands,
Steady Breath, Spare Wire) have been removed. The ten canonical abilities are:

| Game | Ability |
|------|---------|
| Crack the Tumblers / Solo | **Reset Pin** |
| Beat 16 | **In the Bones** |
| Categories | **Skip** |
| The Once-Over | **Hunch** |
| Follow the Circuit | **Photographic** |
| Inside Knowledge | **Narrow It Down** |
| Safe-Crack | **Stethoscope** |
| Assembly Line / Negotiated | **Tip-Off** |
| Steady Hands | **Extra Hands** |
| Defuse the Alarm | **Clear Channel** |

There are exactly **four power-ups, one per lane** (design doc; heist-content.md
GEAR). Holding any lane's power-up means *"you're an ace at that lane's games"*:
the holder gets the **game's single signature ability to shout once per game**.
One per lane per player, no stacking; a player can hold up to four.

- **Eligibility.** `BoostButton` renders **only** when a *committed* player holds a power-up
  in **any** of the game's `lanes`. For a combo game (two lanes), either lane's power-up qualifies.
  `BoostButton` accepts `gameLanes: Lane[]` for this check.
- **Once per game.** Each `BoostHook` fires exactly once per challenge, then its
  button disables. Tracked in `ChallengeState`.
- **The shout.** The button is a physical "shout to use" affordance — the player
  calls it ("Reset Pin!", "Stethoscope!"), the GM/holder taps it, the effect
  applies to live `ChallengeState`.

```ts
interface BoostHook {
  lane: Lane;                 // the boost's nominal lane (for display)
  label: string;             // the shout, e.g. "Reset Pin"
  apply(state: ChallengeState, params: Params): ChallengeState;  // pure
}
```

The `MiniGame.boosts` array carries **exactly one** `BoostHook`. Eligibility fires on
`game.lanes.some(l => player.powerUps[l])` — any held lane power-up qualifies.

The four lane power-ups and their per-game faces are fixed in
`heist-content.md`. Each game's `boosts` array reproduces its row of that table;
the per-game specs in §6 list them.

---

## 5. Judging: what the app senses vs what the GM confirms

The crew plays in the real world. The app does as much *helpful,
non-interfering* work as it can — but **the GM confirms the outcome** and the
app never overrides the room (`the-job-app-design.md §10.4`). `judge` returns a
**suggested** tier; `OutcomeJudge` shows that suggestion with the
clean/complication/botched controls one tap away, and the GM's tap is what feeds
the engine.

Three sensing classes:

- **App fully judges** — the whole challenge happens *in the app* (digits typed,
  cards tapped on a sensed surface). `judge` is authoritative; GM confirm is a
  rubber-stamp they can still override.
- **App-assist** — the app senses *part* (a timer expiry, taps on a sensed
  control) but the physical result needs a human eye. `judge` suggests; GM is
  the real referee.
- **GM judges** — the result lives entirely on the table (a card tower, spoken
  answers counted). The app times and tracks; the GM calls the tier.

| Game | App senses | GM confirms | Class |
|------|-----------|-------------|-------|
| Crack the Tumblers | the played sequence (cards tapped into the app, or GM enters plays); detects the first clash | confirms the clash/clean read; calls tier | **App-assist** |
| Beat 16 | tap timing **if** tapped on the sensed control; measures delta from target beat | if the crew tapped the table not the app, GM judges the tap; else confirms | **App-assist** |
| Categories | the timer; a tally counter the GM taps per valid answer | GM counts answers, rules repeats/hesitations, calls tier | **GM judges** |
| The Once-Over | which changed card(s) the crew picked (tapped on the spread); knows the true change | confirms the pick; calls tier | **App-assist** |
| Follow the Circuit | the taps on the grid (sensed); knows the target sequence and the break point | confirms the chain length reached; calls tier | **App-assist** |
| Inside Knowledge | the timer; right/wrong as the GM marks each answer | GM judges spoken answers, marks each, calls tier | **App-assist** |
| Safe-Crack | the full guess/feedback loop (guesses typed in); knows the code; computes solved/attempts-left | **fully judged** — GM confirms | **App fully judges** |
| Assembly Line | the timer; optionally a "sets complete" tally | GM watches the physical trading, judges whose sets are complete, calls tier | **GM judges** |
| Steady Hands | the timer; target height | GM judges the tower (height reached / toppled), calls tier | **GM judges** |
| Defuse the Alarm | the wiring + rulebook (it generated both); each "cut" (a card flipped) is entered → knows safe vs wrong cut; the timer | confirms; can override (e.g. a misread the GM forgives) | **App fully judges** |

Default tiering shape (each game refines it in §6):

- **clean** — solved comfortably within tolerance/time.
- **complication** — scraped it (just in time, one error, a wobble) — the
  comedic middle.
- **botched** — missed it (timeout, alarm tripped, chain broken early).

---

## 6. Per-game specs

Lanes, generate output, ChallengeState, judging, the two boost effects (from
heist-content.md), dial levers, `minCommit`/variant, and facing. All games are
**GM-facing** except Defuse the Alarm (player-facing rulebook via `player-view`).

---

### 1. Crack the Tumblers — `crack-the-tumblers`

- **Lane:** Tech. **Facing:** GM.
- **generate:** a multiset of number-cards dealt across the crew; the *correct
  ascending order*; gap profile between values.
- **ChallengeState:** the played sequence so far; whether the alarm tripped
  (a clash = a card played out of ascending order); boost-used flags.
- **judge:** **clean** = full ascending sequence completed, no clash;
  **complication** = completed but with one clash recovered (via Reset Pin) or a
  near-miss the GM forgives; **botched** = clash trips the alarm.
- **Boosts (Tech):** **Reset Pin** — undo one misplay without tripping the
  alarm. (Single-lane game: only the Tech power-up applies.)
- **Dial levers:** fewer cards; wider gaps between values (more tolerance).
- **minCommit:** **1 via `soloVariantId`**, true game at **2**. Silent
  coordination has no meaning solo, so solo loads a **separate memory variant**.
- **soloVariantId:** `crack-the-tumblers-solo` — a memory test (recall and
  replay a shown ascending sequence). Same lane, dial, boost; different
  `Component`/`judge`. minCommit 1.

### 2. Beat 16 — `beat-16`

- **Lane:** Physical. **Facing:** GM.
- **generate:** the target beat number to count to; the metronome tempo (BPM);
  how many audible beats precede the mute.
- **ChallengeState:** the tap timestamp(s); the measured delta from the target
  beat; boost-used flag.
- **judge:** **clean** = tap within the tight window; **complication** = within
  the wider window (off but close); **botched** = outside the window / no tap.
  (Pure-skill game — repeats with the dial, per the design doc.)
- **Boosts (Physical):** **In the Bones** — two extra audible beats before the
  mute.
- **Dial levers:** number of beats to count (more = harder); tempo.
- **minCommit:** **1.** Dial-only solo and 2–3.

### 3. Categories — `categories`

- **Lane:** Charm. **Facing:** GM.
- **generate:** the category drawn from the content bank; the target count; the
  timer length.
- **ChallengeState:** the running tally (GM taps per valid answer); the timer;
  boost-used flag.
- **judge (GM-counted):** **clean** = hit the target with time/margin to spare;
  **complication** = hit it just in time / with a forgiven repeat; **botched** =
  fell short.
- **Boosts (Charm):** **Skip** — swap a category you hate.
- **Dial levers:** lower target; longer timer.
- **minCommit:** **1.** Dial-only solo and 2–3.

### 4. The Once-Over — `the-once-over`

- **Lane:** Stealth. **Facing:** GM.
- **generate:** the card spread (~8–10 cards); the change applied after
  screening (swap / flip / remove / rotate); how many changes.
- **ChallengeState:** which card(s) the crew flagged as changed; the study
  timer; boost-used flag.
- **judge:** **clean** = correct change(s) spotted comfortably; **complication**
  = spotted at the buzzer / one of several found; **botched** = wrong or none.
- **Boosts (Stealth):** **Hunch** — the GM gives a clue (pitched live).
- **Dial levers:** longer study time; fewer changes (fewer items).
- **minCommit:** **1.** Dial-only solo and 2–3.

### 5. Follow the Circuit — `follow-the-circuit`

- **Lanes:** Tech + Physical. **Facing:** GM.
- **generate:** the grid of cards; the seed sequence; the target length (the
  Heat-set length to clear); playback speed.
- **ChallengeState:** current round/length reached; the taps this round; whether
  the chain broke; boost-used flags (per lane).
- **judge:** **clean** = reached the target length; **complication** = broke one
  short of target; **botched** = broke early.
- **Boost:** **Photographic** (replay the sequence once). Fires for holder of Tech or Physical power-up.
- **Dial levers:** target length (fewer items); playback speed (tempo).
- **minCommit:** **1.** Dial-only solo and 2–3.

### 6. Inside Knowledge — `inside-knowledge`

- **Lanes:** Tech + Charm. **Facing:** GM.
- **generate:** the question set drawn from the bank; the difficulty tier; the
  question count; the timer.
- **ChallengeState:** per-question right/wrong (GM marks); the timer;
  boost-used flags (per lane).
- **judge:** **clean** = enough correct comfortably; **complication** = just
  past the threshold / at the buzzer; **botched** = fell short.
- **Boost:** **Narrow It Down** (multiple choice on a question). Fires for holder of Tech or Charm power-up.
- **Dial levers:** easier tier (more tolerance); fewer questions; more time.
- **minCommit:** **1.** Dial-only solo and 2–3.

### 7. Safe-Crack — `safe-crack` *(E4 reference game)*

- **Lanes:** Tech + Stealth. **Facing:** GM.
- **generate:** the hidden code (digit count, value range); the guess budget;
  the timer.
- **ChallengeState:** the guesses so far with their feedback ("two right, one in
  place"); guesses remaining; whether solved; boost-used flags (per lane).
- **judge (app fully judges):** **clean** = solved with guesses to spare;
  **complication** = solved on the last guess; **botched** = guesses exhausted
  unsolved.
- **Boost:** **Stethoscope** (reveal a digit's position). Fires for holder of Tech or Stealth power-up.
- **Dial levers:** fewer digits in play (fewer items); more guesses (tolerance);
  more time. Both lanes aggregate into one scalar — see §3 for the accepted
  approximation note on per-lane differentiation.
- **minCommit:** **1.** Dial-only solo and 2–3.

### 8. Assembly Line — `assembly-line`

- **Lanes:** Physical + Charm. **Facing:** GM.
- **generate:** the always-solvable deal (hand size; which set-types are
  actually in play — *not necessarily one of each*); the timer.
- **ChallengeState:** the timer; optional sets-complete tally; boost-used flags
  (per lane).
- **judge (GM-watched):** **clean** = everyone holds a complete set with time to
  spare; **complication** = completed at the buzzer / all-but-one; **botched** =
  not solved.
- **Boost:** **Tip-Off** (reveal which set-types are in play). Fires for holder of Physical or Charm power-up.
- **Dial levers:** hand size; number of types in play (fewer items); time.
- **minCommit:** **2.** **Excluded from solo** (no one to trade with). At **2**:
  the **negotiated-swap variant**. At **3+**: full Pit-style. True game at 3.
- **soloVariantId:** none — solo is *ineligible*, not variant-served (§7).

### 9. Steady Hands — `steady-hands`

- **Lanes:** Physical + Stealth. **Facing:** GM.
- **generate:** the target tower height; the timer. (Pure-skill — repeats with
  the dial.)
- **ChallengeState:** the timer; boost-used flags (per lane). The tower itself
  is physical — the app does not sense it.
- **judge (GM-judged):** **clean** = reached target height standing;
  **complication** = a wobble survived / just short; **botched** = toppled / well short.
- **Boost:** **Extra Hands** (10s where everyone, benched included, helps build — the one sanctioned all-hands moment). Fires for holder of Physical or Stealth power-up.
- **Dial levers:** target height (fewer items / tolerance); timer.
- **minCommit:** **1.** Dial-only solo and 2–3.

### 10. Defuse the Alarm — `defuse-the-alarm` *(player-facing)*

- **Lanes:** Charm + Stealth. **Facing:** **Player** — one player privately sees
  the **rulebook** via the isolated `player-view` surface; the rest see the
  cards (the wires) on the table, not the rules. All other games are GM-facing.
- **generate:** the wiring (a row of cards with properties); the rulebook (cut
  rules read off card properties); the timer. Both regenerate each play.
- **ChallengeState:** each "cut" entered (a card flipped face-down); safe vs
  wrong-cut record; the timer; boost-used flags (per lane).
- **judge (app fully judges):** the app generated both wiring and rules, so it
  knows every correct cut. **clean** = all safe cuts, no wrong cut;
  **complication** = finished at the buzzer; **botched** = a wrong cut trips the alarm / timeout.
- **Boost:** **Clear Channel** (one full sentence allowed). Fires for holder of Charm or Stealth power-up.
- **Dial levers:** simpler rulebook; fewer wires (fewer items); more time.
- **minCommit:** **2.** **Excluded from solo** — asymmetric info collapses with
  one player (the defuser sees wires, the expert reads rules; one person can't be
  both). No dial papers over this.
- **soloVariantId:** none — solo is *ineligible* (§7).
- **player-view note:** the rulebook view must never leak GM-only state
  (CLAUDE.md rule 6). It mirrors only the rulebook slice over the local channel.

---

## 7. Full-team games

Three games require the **whole crew** to play — no subset commits, no resting afterward:

| Game | Why full-team |
|------|---------------|
| **Categories** (`categories`) | Crew rattles off answers as a table — meaningful with everyone shouting |
| **Inside Knowledge** (`insideKnowledge`) | Crew confers on trivia — the whole table brings collective knowledge |
| **Assembly Line** (`assemblyLine` + negotiated) | Whole table trades cards — no one to trade with if benched |

**Contract flag.** `MiniGame.fullTeam = true` on these three games (and the
`assemblyLineNegotiated` variant). The obstacle template in the preset also
carries `fullTeam: true` so the engine can enforce the no-rest rule without
importing the minigame layer.

**No crew-select.** When the GM selects an option whose game is `fullTeam`,
the ObstacleRoom skips the crew-select checkboxes entirely and shows a
"Full team — all N players commit" panel. `CHOOSE_OPTION` is dispatched with
every crew member's ID.

**No exhaustion.** `RESOLVE_MINIGAME` skips `applyExhaustion` for full-team
games — nobody rests the next room. The `fullTeam` flag on `ObstacleOption`
(propagated from the template at generation time) drives this check in
`reduce.ts`.

**GM override still works.** The GM can edit committed crew and outcome at any
time via the standard override controls — the full-team shortcut is a UI
convenience, not a lock.

---

## 8. Solo / 2–3 player variants & the generator rule



Reproduced faithfully from `the-job-app-design.md §10.5`. Each game carries
`minCommit` (a hard floor) and, where solo needs a different mechanic, a
`soloVariantId`.

| Game | Solo (1 committed) | 2–3 committed | Min viable |
|------|--------------------|---------------|-----------|
| Beat 16, Categories, The Once-Over, Follow the Circuit, Inside Knowledge, Safe-Crack, Steady Hands | Dial only | Dial only | **1** |
| Crack the Tumblers | **Separate solo variant** (memory test — silent-sync has no meaning solo) | Dial | **1** (variant) / **2** (true game) |
| Assembly Line | **Excluded** (no one to trade with) | Variant @2 (negotiated-swap), Dial @3 | **2** / **3** |
| Defuse the Alarm | **Excluded** (asymmetric info collapses with one player) | Dial | **2** |

**The seven dial-only games** (minCommit 1, work solo and 2–3 with just the
dial): Beat 16, Categories, The Once-Over, Follow the Circuit, Inside Knowledge,
Safe-Crack, Steady Hands. With Crack the Tumblers' solo variant, the
**solo-eligible pool is ≥8** — single-commit obstacles never starve.

**Generator eligibility rule (order matters):**

1. **Filter on `minCommit` first** — eligibility, before anything else.
   Difficulty is **never** used to paper over a missing player.
2. **Resolve variant-vs-parent by slot size** — e.g. solo Crack the Tumblers →
   its memory variant; Assembly Line @2 → negotiated-swap variant, @3+ → full;
   Defuse needs ≥2.
3. **Then apply the dial** from committed lane rating(s).

**Re-roll, don't down-dial.** Keep the solo-eligible pool ≥8 so single-commit
slots are always fillable. If a layout would force an **excluded** game
(Assembly Line, Defuse the Alarm) onto a solo slot, **re-roll the obstacle** —
do not down-dial an impossible mechanic. A missing player is a player problem,
not a difficulty problem.

```ts
// engine-side, illustrative
function pickGameForSlot(slot: ObstacleSlot, rng: RNG): GameId {
  const eligible = ALL_GAMES.filter(g => g.minCommit <= slot.committed.length);
  if (eligible.length === 0) return RE_ROLL_OBSTACLE;   // never down-dial
  const game = rng.pick(eligible);
  return resolveVariant(game, slot.committed.length);   // variant by slot size
  // dial applied afterwards, from committed lane rating(s)
}
```

---

## 9. How to add an 11th game

The contract makes this a contained job. Checklist:

1. **Design fit.** It must occupy a lane or a lane-pair on the grid (the current
   grid is full at ten — an 11th means a *variant* of a lane/combo, or a design
   change to the grid, which is a design-doc decision: do not invent a lane.
   Block via `PIPELINE_BLOCKED` if unclear).
2. **Implement the contract.** `id`, `lanes`, `generate(rng, dial)` (pure, RNG
   only), `Component`, pure `judge`, `boosts`, `minCommit`, optional
   `soloVariantId`.
3. **Reuse primitives.** Prefer `Timer`, `CardSpread`, `Metronome`,
   `BoostButton`, `OutcomeJudge`, `DialReadout` — do not re-roll your own. Add a
   new shared primitive only if genuinely novel, and document it in §below-the-
   fold here.
4. **Boosts from content.** Add the game's row to the power-up table in
   `heist-content.md` (one effect per held lane), then mirror it in `boosts`.
5. **Dial levers.** Decide which of more-time / fewer-items / wider-tolerance /
   slower-tempo the dial drives, and wire the aggregation through the
   **scaling preset** — never hardcode the curve.
6. **Solo/scaling.** Set `minCommit`. If the mechanic is meaningless or
   impossible below some headcount, either add a `soloVariantId` (Crack the
   Tumblers pattern) or mark it **excluded** and ensure the generator re-rolls
   rather than down-dials (§7). Keep the solo-eligible pool ≥8.
7. **Judging row.** Add the game to the §5 table: what the app senses vs what
   the GM confirms. The app suggests; the GM confirms; `onResolve` is GM-driven.
8. **Tests.** Generator reproducibility (seed + dial ⇒ same params); pure
   `judge` over the tier boundaries; boost `apply` once-per-game; the generator
   never offers an ineligible game in a too-small slot (the `minCommit` test
   from E5's acceptance gate).
9. **Register it.** Add to the game registry the room loop reads from, and the
   grid lookup in §2.

Then run `npm run check:full`. A new game is *done* only when it runs inside the
loop, regenerates fresh each play, respects its `minCommit`/dial, fires its
boosts once, and the GM-confirm judging feeds the engine.

---

## 10. Shared primitives reference

Build once, reuse across all ten (E4). API sketches are illustrative.

### `Timer`
Audible countdown with ticking, pause, and a duration set by the dial.
```ts
function Timer(props: {
  seconds: number; running: boolean;
  onExpire(): void; audible?: boolean;
}): JSX.Element;
```
**Used by:** Categories, Inside Knowledge, The Once-Over, Steady Hands, Assembly
Line, Defuse the Alarm, Safe-Crack (and any game with a clock).

### `CardSpread`
Renders face-up/face-down cards in a layout; supports flip, tap-to-select.
```ts
function CardSpread(props: {
  cards: Card[]; layout: 'row' | 'grid';
  faceDown?: CardId[]; onTap?(id: CardId): void;
}): JSX.Element;
```
**Used by:** The Once-Over (the room), Defuse the Alarm (the wires), Follow the
Circuit (the grid), Crack the Tumblers (the pins).

### `Metronome`
Precise Web Audio clock (not `setTimeout`) — coordinated with the audio engine
(E9). Emits beats; can mute on cue.
```ts
function useMetronome(opts: {
  bpm: number; audibleBeats: number;
}): { onBeat(cb: (n: number) => void): void; mute(): void };
```
**Used by:** Beat 16, Follow the Circuit (playback).

### `BoostButton`
Context-aware "shout to use" control. Renders **only** for a committed player
holding the lane power-up; fires **once per game**, then disables.
```ts
function BoostButton(props: {
  hook: BoostHook; committed: CommittedPlayer[];
  onFire(hook: BoostHook): void;   // applies hook.apply, marks used
}): JSX.Element | null;            // null when nobody committed holds the lane
```
**Used by:** all ten (each surfaces its lane's boost(s)).

### `OutcomeJudge`
The clean/complication/botched control, pre-set to `judge`'s **suggested** tier,
the comedic middle always one tap away. The GM's tap is authoritative
(`the-job-app-design.md §10.4`).
```ts
function OutcomeJudge(props: {
  suggested: Outcome; onConfirm(o: Outcome): void;
}): JSX.Element;
```
**Used by:** all ten.

### `DialReadout`
**GM-only** display of the resolved difficulty so the GM knows how hard it's
set, without showing the crew.
```ts
function DialReadout(props: { dial: Difficulty }): JSX.Element;  // GM surface only
```
**Used by:** all ten (on the referee screen).
