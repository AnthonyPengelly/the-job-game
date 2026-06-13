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

> **Three standing decisions (playtest wave, 2026-06):**
>
> 1. **The game is pre-bound to the obstacle option at generation time.** The
>    room template carries `gameId`; `CHOOSE_OPTION` never re-resolves the game
>    from the committed lanes. "Pick your specialists, get your game" was never
>    the intent — the room poses the game, and it is up to the *players* to
>    send the right people. Stats reward the right pick through the dial
>    (visible live on the commit panel), not by changing the game.
> 2. **The GM screen is GM-only.** The crew never looks at the console.
>    Anything the crew must see lives on the table (physical cards) or on the
>    isolated player-view. Referee screens give the GM *setup instructions*
>    (what to deal from one shuffled pack — never "find these specific cards")
>    and *recording controls* (✓/✗ taps); they never render information the
>    crew is supposed to discover.
> 3. **The room dictates the exact headcount** (playtest wave 2). Options no
>    longer carry a `[min, max]` commit range for the GM to fill freely:
>    `generateRoom` draws one exact `commitCount` per option (seeded RNG)
>    within the scaling-legal range — `minCommit`/`fullTeam`/solo rules
>    still bound the draw, so Assembly Line and Defuse can never demand 1.
>    The commit panel reads "it takes exactly N" and Commit enables only at
>    exactly N, so the dial preview always describes a concrete crew
>    ("these N players, these stats"). `tightenPerExtraCrew` in the dial
>    curve stays: with the count dictated it is no longer a lever players
>    can pull, just normalisation that keeps bigger-crew rooms from reading
>    harder than they are. The GM can still override the committed set via
>    the standard overrides — no dead-ends.

The loop:

1. **Option chosen.** The obstacle's option carries its pre-bound `gameId`.
   `CHOOSE_OPTION` carries the committed `PlayerId[]`.
2. **Resolve variant.** Apply the `minCommit`/`soloVariant` rule (§7) for the
   committed headcount **before** the dial.
3. **Compute the dial** from the committed crew's lane rating(s) (§3).
4. **`generate(rng, dial)`** fresh params from the run's RNG stream.
5. **Mount `Component`.** The GM deals per the setup panel, then referees;
   `BoostButton`s surface for any committed power-up holder.
6. **`judge` suggests, GM confirms** via `OutcomeJudge`; `onResolve` feeds the
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
in their committed lane. All committed lane ratings aggregate into a single
scalar `dial.level` via `computeDial`, weighted by the **average** committed
rating (`perLanePoint` preset field × mean, never hardcoded — see
`docs/CONTENT-AND-TUNING.md`). Wave 3 decision: the average, not the sum — a
full-team commit must not be wildly easier than two specialists, and a weak
tag-along drags the average (and the table sees it live on the commit-panel
dial). A small residual per-entry easing (`tightenPerExtraCrew`) keeps "more
hands help a little" true. The design calls for each lane to ease its own
half of difficulty (e.g. Safe-Crack: Tech → digit count, Stealth → guess count),
but the current implementation drives all levers from the same scalar — this is
the **accepted E4 trade-off**; per-lane differentiation can be added in a later
epic by threading per-lane levels through `Difficulty`.

The dial expresses itself through four levers (design doc, "Stats dial
difficulty"):

| Lever | Easier (high rating) | Harder (low rating) | Games it drives |
|-------|----------------------|---------------------|-----------------|
| **More time** | longer timer | shorter timer | Categories, Inside Knowledge, Defuse, Steady Hands, The Once-Over |
| **Fewer items** | fewer cards/digits/questions/wires/bogus | more | Crack the Tumblers, Safe-Crack, Inside Knowledge, Silence, Defuse, The Once-Over |
| **Wider tolerance** | bigger gaps, more guesses, lower target | tighter | Crack the Tumblers, Safe-Crack, Categories, Steady Hands, Follow the Circuit |
| **Slower tempo** | slower playback / fewer beats | faster / more beats | Follow the Circuit |
| **Longer count (Beat 16)** | fewer beats to count, FASTER tempo | more beats, SLOWER tempo | Beat 16 (wave 4: slow tempo over a long silent count is the hard case) |

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
| Silence / two-player | **Tip-Off** |
| Steady Hands | **Extra Hands** |
| Defuse the Alarm | **Insulated Gloves** |

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
| Crack the Tumblers | the GM's ✓ in-order / ✗ clash taps as physical cards hit the table; the count vs the dealt total | the table judges ascending order live; GM records and calls tier | **GM judges** |
| Beat 16 | the metronome and target beat; the GM's tap (reaction-compensated) when the player slaps the table; the ms delta | GM taps on hearing the slap, reveals the delta, confirms | **App-assist** |
| Categories | the timer; a tally counter the GM taps per valid answer | GM counts answers, rules repeats/hesitations, calls tier | **GM judges** |
| The Once-Over | the positional change instructions it generated; the GM's ✓ spotted / ✗ wrong-call taps | GM applies the changes to the physical row, scores callouts, calls tier | **GM judges** |
| Follow the Circuit | the taps on the grid (sensed); knows the target sequence and the break point | confirms the chain length reached; calls tier | **App-assist** |
| Inside Knowledge | the timer; right/wrong as the GM marks each answer | GM judges spoken answers, marks each, calls tier | **App-assist** |
| Safe-Crack | the full guess/feedback loop (guesses typed in); knows the code; computes solved/attempts-left; the timer | **fully judged** — GM confirms | **App fully judges** |
| Silence | the timer; the "sets complete" tally; the deck-build it prescribed | GM watches the silent passing, counts sets laid down, calls tier | **GM judges** |
| Steady Hands | the timer; target height; the GM's tier tally | GM taps tiers as they stand, judges topples, calls tier | **GM judges** |
| Defuse the Alarm | the property rules it generated; the GM's ✓ safe / ✗ wrong / all-clear taps; the timer | GM sees both the dealt row and the rules; records each cut; can forgive a misread | **GM judges** |

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

- **Lane:** Tech. **Facing:** GM (the cards face the table).
- **generate:** `totalCards` (wave 4: a **total**, 4–24 by dial, not a
  per-player count — two players one card each was trivial). The deal is
  physical: shuffle, deal the total across the committed crew split as evenly
  as possible (every player ≥1; the screen shows the per-player brackets);
  players peek at their own only; no talking. The app never knows the values —
  the shuffle is the RNG.
- **Play:** the crew plays every card to the table one at a time in ascending
  rank order (Ace low). On **equal ranks they must play in suit alphabetical
  order — Clubs → Diamonds → Hearts → Spades** (wave 4). The suit tiebreak
  stops a long deal collapsing into "just play every number in order"; ties
  still demand silent coordination. The GM records each play with ✓ in-order /
  ✗ clash (a tie out of suit order is a clash).
- **ChallengeState:** total cards; plays recorded; alarm tripped; boost flag.
- **judge:** **clean** = every card recorded in order, no clash;
  **complication** = completed but one clash recovered via Reset Pin;
  **botched** = a clash tripped the alarm, or incomplete when called.
- **Boosts (Tech):** **Reset Pin** — forgive one clash; the misplayed card goes
  back to its holder's hand and was never counted.
- **Dial lever:** total cards (longer silent sequence = harder).
- **minCommit:** **2**, and **full-team** since wave 3 — the whole crew plays
  and nobody rests (silent coordination is the table's game). The solo memory
  variant stays registered for safety but is never offered to a 2+ crew.
- **soloVariantId:** `crack-the-tumblers-solo` — physical memory test: deal
  `cardCount` random cards face-up in a row, study under the clock, flip
  face-down in place, then flip back one at a time in ascending order. Every
  reveal is public, so the whole table verifies each flip; the GM records.

### 2. Beat 16 — `beat-16`

- **Lane:** Physical. **Facing:** GM.
- **generate:** the target beat number to count to; the metronome tempo (BPM);
  how many audible beats precede the mute; `reactionCompensationMs`.
- **Play:** the player **slaps the table** on the target beat; the GM taps the
  console the instant they hear it. The app credits back the hear-and-tap
  reaction chain (`reactionCompensationMs`) and scores the player's slap,
  then shows a big signed ms delta for the GM to reveal with drama.
- **ChallengeState:** the tap timestamp; the reaction-adjusted delta from the
  target beat; boost-used flag.
- **judge:** **clean** = adjusted delta within the tight window;
  **complication** = within the wider window (off but close); **botched** =
  outside the window / no tap. (Pure-skill game — repeats with the dial.)
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
- **judge (GM-counted):** **clean** = hit the target (regardless of timer);
  **complication** = one short of target; **botched** = fell short.
- **Boosts (Charm):** **Skip** — swap a category you hate.
- **Dial levers:** lower target; longer timer.
- **minCommit:** **1.** Dial-only solo and 2–3.

### 4. The Once-Over — `the-once-over`

- **Lane:** Stealth. **Facing:** GM (the cards face the table).
- **generate:** the deal size (8–10) and **positional** change instructions —
  "swap positions 2 and 7", "replace position 4 with the top card of the deck".
  Positions, not card names: any random deal works, zero setup hunting. Swap
  and replace are the two change types that leave no visual tell in a random
  row (removals left holes that answered the puzzle themselves).
- **Play:** deal any cards face-up in a row; crew studies under the clock; the
  crew looks away while the GM applies the instructions (only the GM screen
  shows them); reveal; the crew calls out what changed and the GM scores each
  callout ✓ spotted / ✗ wrong call.
- **ChallengeState:** hits; misses; study-expired; boost-used flag.
- **judge:** **clean** = every change spotted; **complication** = some but not
  all; **botched** = none.
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
- **judge:** **clean** = reached the threshold (regardless of timer);
  **complication** = one short of threshold; **botched** = fell short.
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
- **Dial levers:** more guesses (tolerance); more time. The code stays small —
  3 digits, 4 only at high dial — and the guess budget never drops below
  digits + 2: digit count and guesses must never scale against the player
  simultaneously (a 6-digit/3-guess code is information-theoretically
  unwinnable). Both lanes aggregate into one scalar — see §3.
- **minCommit:** **1.** Dial-only solo and 2–3.

### 8. Silence — `assembly-line` *(renamed wave 4; was Assembly Line)*

> **Wave 4 redesign.** The old free-for-all trading game was too easy. Silence
> is a **silent simultaneous pass-the-card** game (Donkey/Pig, co-op). The
> gameId stays `assemblyLine` (and `assemblyLineNegotiated` for the 2-player
> variant) to avoid a rename storm across scaling/templates/narration.

- **Lanes:** Physical + Charm. **Facing:** GM.
- **generate:** a shuffled 13-rank order + `decoyCount` (1 easy / 2 medium /
  ~4 brutal — bogus cards are the **main lever**, capped at the player count so
  no hand exceeds five) + the timer (40–100s, frantic; the 2-player variant
  50–110s). The setup panel tells the GM exactly what to pull — all four of one
  rank per player, plus `decoyCount` **single bogus cards** of other ranks —
  shuffle, deal four each (the bogus cards make that many players hold five).
- **Play:** **no talking.** The crew sits in a circle; on a silent count
  everyone passes one card left at the same time, fast as they can, collecting
  four of a kind. Lay a set down and you're safe — but keep passing while you
  still hold a card. The bogus cards can never form a set, so they circulate and
  someone ends up stuck with them (that's fine — co-op, no loser). The round is
  won when **every real set is down** before the buzzer.
- **ChallengeState:** the timer; sets-complete tally; boost-used flag.
- **judge (GM-watched):** **clean** = every set laid down (regardless of timer);
  **complication** = all-but-one / in progress; **botched** = timer expired
  with sets unfinished.
- **Boost:** **Tip-Off** (names the real ranks in play — so you don't hoard a
  bogus card). Fires for holder of Physical or Charm power-up.
- **Dial levers:** bogus-card count (primary); time.
- **minCommit:** **2.** **Excluded from solo** (no circle of one). At **2**: the
  two-player swap variant; at **3+**: the full circle.
- **soloVariantId:** none — solo is *ineligible*, not variant-served (§7).

### 9. Steady Hands — `steady-hands`

- **Lanes:** Physical + Stealth. **Facing:** GM.
- **generate:** the target tower height (2–4 — a "tier" is a real card-house
  storey: two leaning cards capped flat; six tiers under a clock was fantasy);
  the timer (60–150s). (Pure-skill — repeats with the dial.)
- **ChallengeState:** the timer; boost-used flags (per lane). The tower itself
  is physical — the app does not sense it.
- **judge (GM-judged):** **clean** = reached target height standing;
  **complication** = a wobble survived / just short; **botched** = toppled / well short.
- **Boost:** **Extra Hands** (10s where everyone, benched included, helps build — the one sanctioned all-hands moment). Fires for holder of Physical or Stealth power-up.
- **Dial levers:** target height (fewer items / tolerance); timer.
- **minCommit:** **1.** Dial-only solo and 2–3.

### 10. Defuse the Alarm — `defuse-the-alarm` *(player-facing)*

> **Playtest wave 2 redesign (2026-06):** one-laptop handoff flow + a
> first-match-wins rulebook engine. **Wave 4:** harder, Murdle-style
> deduction clauses (3–6 per book) + a GM card-input solver. Details below.

- **Lanes:** Charm + Stealth. **Facing:** **Player** — one player (the
  **reader**) privately sees the **rulebook**; the rest see the cards (the
  wires) on the table, not the rules. All other games are GM-facing.
- **generate:** the deal size (4–8 wires), the rulebook (an **ordered clause
  list**, see below) and the timer. All clauses reference **standard-pack
  properties** (colour, suit, face cards, value bands, position in the row),
  so any random deal is decidable — the app never needs to know the cards.
- **The rulebook engine.** Clause shapes compose under one reading rule —
  *"top to bottom: the FIRST rule that covers a wire decides it; anything no
  rule covers stays uncut"*:
  - **protections** — "Never cut FACE-CARD wires."
  - **positional bans** — "Never cut the LEFTMOST wire in the row."
  - **count-based cuts** — "Cut exactly the TWO highest HEART wires — no
    other HEARTS."
  - **exceptions** — "Cut BLACK wires — UNLESS it's a face card."
  - **relational (wave 4)** — "Cut any wire whose LEFT neighbour is a face
    card" (the end wire has no such neighbour).
  - **superlative (wave 4)** — "Cut the single HIGHEST-ranked wire in the
    whole row (ties → the leftmost)."
  Wave 4 raises the count to **3–6 clauses** and adds the relational and
  superlative shapes so the table must reason about the *row* (adjacency,
  global extremes), Murdle-style, not just read each card. First-match-wins
  keeps every rulebook decidable by construction; a pure
  `classifyWires(clauses, deal)` proves it, **property-tested over 1000 seeds
  × random 8-card deals** (every card classifies, deterministically, no
  throws), and over random deals a rulebook leaves both cuts and keeps on a
  typical row. Exclusion groups prevent degenerate rulebooks: never both
  colours, one value band, a protection never erases its own cut clause, face
  rules never starve a count-based cut, at most one of each positional /
  relational / superlative clause.
- **The card-input solver (wave 4).** GM-only tool (in the live & adjudicate
  panels, never on the reader handoff overlay): the GM types the dealt row
  (rank + suit per wire) and the app runs `solveDeal` to show each wire's
  CUT/keep verdict and **the cut order left-to-right** ("Cut: #2 → #5"). This
  is how the GM checks the crew's work at the end, or settles an argument.
- **Play — two table modes** (chosen on the setup panel):
  - **Two devices:** the reader holds the rulebook on the isolated
    player-view; the GM keeps the console and records cuts live (the
    original flow; the channel replays the slice on connect).
  - **One laptop (the handoff):** the GM hands the console to the reader —
    it becomes a **fullscreen reader view** showing ONLY the rulebook and
    the countdown (a sanctioned reader exception like the player-view:
    nothing GM-only renders). The crew plays the row physically, flipping
    named wires face-down. When the reader declares done (or the clock
    expires), the laptop comes back and the GM **adjudicates
    retrospectively** — walks the row against the rules, records ✓ safe
    cuts / ✗ a wrong cut, and declares all clear. The bomb squad checks
    your work.
- **ChallengeState:** safe-cut count; wrong-cut flag; all-clear flag; the
  timer; boost-used flag. (Same state for both modes — live recording and
  retrospective adjudication feed the same judge.)
- **judge (GM-recorded):** **clean** = all clear declared, no wrong cut
  (regardless of timer); **complication** = still defusing; **botched** = a
  wrong cut trips the alarm / timer expired first (GM's call after a handoff
  — the clock coming back at zero with an unfinished row reads botched).
- **Boost:** **Insulated Gloves** (wave 3, replacing Clear Channel) — the first
  wrong cut doesn't trip the alarm, once per game; shout it pre-emptively to arm
  it or right after the snip to take the mistake back. A forgiven cut caps the
  result at complication. Fires for holder of Charm or Stealth power-up.
- **Dial levers:** simpler rulebook (clause complexity); fewer wires (fewer
  items); more time.
- **minCommit:** **2.** **Excluded from solo** — asymmetric info collapses with
  one player (the defuser sees wires, the expert reads rules; one person can't be
  both). No dial papers over this.
- **soloVariantId:** none — solo is *ineligible* (§7).
- **player-view note:** the rulebook view must never leak GM-only state
  (CLAUDE.md rule 6). It mirrors only the rendered rule lines over the local
  channel — same strings the fullscreen handoff view shows.

---

## 7. Full-team games

Four games require the **whole crew** to play — no subset commits, no resting afterward:

| Game | Why full-team |
|------|---------------|
| **Categories** (`categories`) | Crew rattles off answers as a table — meaningful with everyone shouting |
| **Inside Knowledge** (`insideKnowledge`) | Crew confers on trivia — the whole table brings collective knowledge |
| **Silence** (`assemblyLine` + 2-player variant) | The whole circle passes cards in silence — no circle of one |
| **Crack the Tumblers** (`crackTheTumblers`) | Silent coordination is the whole table's game (wave 3) — benching spectators broke the fun; the solo memory variant remains registered but is never offered to a 2+ crew |

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
