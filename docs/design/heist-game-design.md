# The Job — Design Doc (v0.9)

A co-op heist roguelike. One laptop (the narrator/"van"), a deck of cards, a tabletop. 2–7 players, ~30 minutes per run. Trivial to learn, different every time, built on push-your-luck: *grab more, or get out before the Heat catches you.*

> **v0.9 (build-era) revisions** — driven by first full-build playtest, implemented by EPICS **E14–E20**:
> 1. **Loot reads as a real haul** (dramatic figures, e.g. `$3.6k … $137k`), not single digits. *(E14)*
> 2. **Every room offers Gear, not just Loot** — and the crew can decline a piece of gear to bank **more Loot instead** (sell-don't-use), so the build is a live decision. *(E14)*
> 3. **Difficulty and reward ride Heat/depth** — early rooms forgiving and thin, later rooms punishing and rich; staying clean late requires having levelled the right lanes. *(E15)*
> 4. **Getaway ditch drops Loot, not Heat**, and **buying seconds is removed** (power-up *skips* remain). *(E20)*
> 5. **One signature power-up ability per game**, triggered by holding a power-up in *any* lane that game
>    uses — *not* a different effect per lane. Combo games keep a single ability (e.g. Steady Hands =
>    **Extra Hands**; *Steady Breath, Muscle Memory, Cheat Sheet, Patient Touch, Quick Hands and Spare
>    Wire are retired*). *(E18)*
>
> These points **override** the corresponding text below where they conflict.

---

## The pitch

You're a crew pulling one job. The laptop runs the heist; you, the **narrator**, play *the guy in the van* — feeding clues, working the doors, running the soundboard. The crew moves through procedurally generated rooms, choosing how to tackle each one via short tabletop mini-games, banking loot and gear while a shared **Heat** meter climbs. Every room, the van offers the exit. Stay too long and you're caught; leave too early and you walk with scraps. When you call it, the whole crew plays one big **Getaway** game whose difficulty rides on your Heat. Escape with a number, or get busted with a smaller one — then go again. Every job is set in a **rich person's mansion** — only the dressing changes (a villa, an estate, a penthouse).

Players hold only cards. All randomness, bookkeeping, scaling, scoring, prompts, narration, and sound live on the laptop. The crew never touches the computer.

## Design goals

- **Not nerdy.** Everyone knows heists from films. No rulebook needed to start.
- **Trivial to learn, deep per run.** Tiny player-facing rules; complexity lives in the laptop.
- **"I can do better."** Every run ends in a score, including failures.
- **Scales 2–7** without changing the rules players hold in their heads.
- **Drop-in friendly.** No setup asymmetry; first-timers aren't behind.
- **No props, no acting.** Cards and table only; skill games, not improv. (Two sanctioned exceptions: Articulate cards for the Getaway, and *Extra Hands*.)

---

## The crew — emergent specialists

Everyone starts identical: mediocre across four stats — **Tech, Physical, Charm, Stealth.** You don't pick a role; you *become* one through gear (power-ups) earned during the run.

- **Tech** — codes, sequences, logic, pattern-spotting.
- **Physical** — timing, dexterity, precision; the strike that lands exactly right.
- **Charm** — words, knowledge, fast coordination.
- **Stealth** — silence, observation, steady nerves, not getting caught.

### Gear — the build (two layers)

Two kinds of reward, both **mechanically transparent** — you always see what you're getting. The deliberate build is where players express "I'm becoming the hacker," so it's never a blind gamble; the gambles live in Scenarios instead. Light heist names dress the effect, but the effect is always shown.

**Stat boosts — common, and they stack.** A +1 to a lane of the crew's choice (*Better Tools* → Tech, *Hit the Gym* → Physical, *Did the Homework* → Charm, *Soft Shoes* → Stealth). Your lane rating is the passive **difficulty dial** for every game in that lane, so any boost helps all of it — scaling, not prerequisites, and no build-killers. Stacking these is how you specialise.

**Power-ups — rare, the shouted plays. There are exactly four: one per lane.** Holding the Tech power-up means "you're an ace at Tech games." **Each *game* has exactly one signature power-up ability** (Reset Pin in Crack the Tumblers, Stethoscope in Safe-Crack, Extra Hands in Steady Hands, and so on — full list below), and a committed player may **shout it once** if they hold a power-up in **any lane that game uses**. So in a combo game, holding *either* of its two lane power-ups unlocks that game's one ability — it is not a different effect per lane. **One per lane per player; they don't stack** — you can hold up to four, one of each. Different flavour items may grant the same power-up.

**Who gets it.** The crew assigns each reward to a player, so you build your specialists together ("give Sara the Tech boost — she's our hacker"). Exhaustion rotation means everyone develops, and the Getaway puts the whole built-up crew to work.

Each player also starts with one free **starter quirk**, so they're distinct from turn one.

---

## The run

A **procedurally generated stream** of rooms — no fixed length, no boss. Heat rises every room (a baseline drip plus extra from loud or greedy choices). After every room the van offers the door: *push on, or call the Getaway.* The run ends when the crew chooses to escape — or when Heat maxes and forces an emergency one. Tuned so most crews escape after roughly 4–6 rooms, landing near 30 minutes.

### Two room types

- **Obstacle** — a security problem beaten with a mini-game. The room offers 2–3 **options**, each tied to a specific game, a **reward** (Loot, Gear, or both), and a **Heat cost**. Greedy options pay more and burn hotter. **Most rooms put Gear on the table** — and when a reward includes Gear the crew may **decline the piece to bank more Loot instead** (sell-don't-use), making "specialise or cash out" a live, recurring decision rather than a passive drop. *(v0.9 — E14.)*
- **Scenario** — short and fun. The narrator reads a situation with **two choices**. Each hides a **secret effect** revealed only after you commit — it can move *anything*: Heat, Loot, Gear, or *info*. Some choices resolve as a hidden **lane-weighted roll**: the crew picks who attempts it, and that player's (concealed) stat in a relevant lane tips the odds, so sending the right specialist matters. A quick gamble and a palate-cleanser between obstacles.

### The room loop (obstacles)

1. **The van gives a clue.** A vague read on what's ahead — *"Place is wired to the teeth"* (smells Tech), *"Crawling with staff"* (smells Charm).
2. **Options revealed.** The room presents its 2–3 options — the *room* dictates which games are possible; the crew just chooses one, weighing reward vs Heat.
3. **Commit the crew.** Assign the players the option needs (1–3), drawn from those not resting.
4. **Play the mini-game.** Performance resolves as **clean** (full reward, low Heat) / **complication** (partial reward, extra Heat) / **botched** (little or nothing, Heat spikes). The middle tier — "cracked it, but knocked a vase" — is where the laughs live.
5. **Exhaustion + the offer.** The crew who just played **rest the next room** (rotation, so everyone gets turns); benched players simply watch. Then the van offers: *push on, or run.*

### Outcomes & failure

Every obstacle resolves into one of three tiers, judged against the game's target:

- **Clean** — beat it comfortably: full reward, minimal Heat.
- **Complication** — scrape it: partial reward, extra Heat. The comedic middle ("got the cash, woke the dog").
- **Botched** — miss it: no reward, Heat spikes.

Failure is deliberately **soft — there is no mid-run death.** A botch costs you the reward on offer and ticks Heat up; it never ends the run on the spot. That *is* the push-your-luck engine: every failure pushes the forced Getaway closer, so the crew feels the noose tighten without ever being knocked out. Greedy options run a harder dial **and** a bigger Heat spike on a botch, so risk tracks reward. Banked loot and gear are never lost — failure only denies what was on offer. No retries except via a shouted boost.

---

## Heat — the one meter

One shared bar = the whole tension (no separate health). Heat rises every room and from loud/greedy play; scenarios are the main way to cool it back down.

The run ends two ways:

- **Call the Getaway and pull it off** → win. Bank everything: scored on Loot, with a style bonus for low Heat.
- **Fail the Getaway, or let Heat max out** → busted. Bank a *reduced* haul ("£380k before the sirens").

Because even failure gives a number, it's never "we lost, pack it up" — it's "we can beat that." The single decision every room — **push or run** — carries the whole game.

### The numbers (tuned by simulation)

A Monte Carlo of ~1M runs (model saved as `heat-model-simulation.py`) settled these values:

- **Track 0–20**, shown as face-down cards; steps stay small (+1 to +4).
- **Each obstacle:** +1 Heat for a safe approach, +2 for a greedy one.
- **Mini-game outcome (on top):** clean +0 · complication +1 · botched +2.
- **Escalation ramp:** +1 extra Heat per obstacle once a job's been running a while (≈the 5th room on), so Heat always builds to a head even if scenarios keep cooling it — a run can't loop forever.
- **Scenarios:** small ↑/↓ = ±2, big ⇈/⇊ = ±4; loot/gear/info = 0 Heat.
- **Escape signal at Heat 11 (~55%):** the van calls *"it's getting hot — we can roll."* Run now, or push deeper for more Loot as the Getaway worsens. **Heat 20 = forced emergency Getaway** at the worst odds.
- **Getaway success rides on Heat** (plus Articulate skill and headcount): ~90%+ when cool, ~50/50 at the escape signal, ~15–25% near max.
- **Difficulty & reward ride Heat/depth (v0.9):** on top of the per-game stat dial, both mini-game difficulty *and* the Loot/Gear on offer scale up with Heat and how deep the run is — early rooms are forgiving and thin, later rooms punishing and rich. Pushing your luck therefore means harder games for bigger numbers, and a crew that hasn't levelled the relevant lanes can no longer stay clean late. Exact curves are tuning data, re-asserted by the balance harness (E15).

**What the model showed:**

- Typical run: **~4–5 obstacles, ~6 rooms, ~25–30 minutes**; runs almost never drag past 10 rooms (~2–3%).
- **Skill separates, luck doesn't dominate:** an average crew escapes ~48%, a sharp one ~57%, a sloppy one ~37%; Loot banked roughly **doubles** from a poor to a good crew — yet run length stays within ±1 obstacle of the median ~98% of the time.
- **More players helps a little:** win rate rises ~6–7 points from 2 to 7 players (lane coverage + more cluers).
- A botch only adds +2, so no single moment ends the run — failure surfaces as rising Heat and a scarier Getaway. That *is* the push-your-luck tension.

---

## The Getaway (the exit game)

The finale: a **whole-team** game, deliberately different from everything else, played with cards from **Articulate** (the existing party game — no design needed, just grab the box). **Its difficulty is set by your Heat at the moment you call it** — the greedier you were, the brutaler the escape.

- The crew sits in a circle. The narrator starts the clock; **length and target are set by Heat** (low Heat = generous; high Heat = short and steep).
- **Round the circle:** each player in turn flips the top card and gives clues (describe it, Catch Phrase style — no saying the word) until the team shouts it right, then play passes on to the next person and the next card.
- Clear the **target number of cards** (Heat-scaled) before time runs out to escape clean. Stuck on one? **Ditch it** — skip the card but **drop some banked Loot** (ditching costs *Loot*, not Heat — revised v0.9), and move on.
- Banked **Gear** can be spent here too: a power-up holder can **skip a card** (one skip per power-up). *(Buying seconds was removed in v0.9 — see E20.)*

Why it works: everyone clues, so the whole table is in it; it's fast, loud, and celebratory — the right energy for a climax; and the Heat scaling is what makes greed genuinely risky. (Describe-to-guess is verbal cluing, not acting — sanctioned for the finale.)

---

## The mini-games

Each obstacle is resolved by a short tabletop mini-game — Crystal Maze meets escape room, run by the narrator off the laptop. The crew plays with cards and what's on the table; the laptop generates the challenge, times it, judges it, and drives the sound.

### Three principles

- **One framework, swappable flesh.** A library of games tagged by lane. The option chosen and who's committed select the game: one specialist → that lane's single game; two committed crew in different lanes → the combo game.
- **Replayable, never one-shot.** Games are procedurally parameterised — layout, code, questions, sequence regenerate each run. You learn the *method* once; the *answer* is always fresh. (A few — Beat 16, Steady Hands — are pure-skill and simply repeat with the dial; that's fine.)
- **Stats dial difficulty; boosts are shouted plays.**
  - **Stats (passive).** Your build eases the game automatically — more time, fewer items, wider tolerance, slower tempo. Specialising turns the dial down.
  - **Boosts (active).** There are exactly four power-ups — one per lane. **Each game has one signature ability** ("Reset Pin!", "Stethoscope!", "Extra Hands!"), and any committed player holding a power-up in *any lane the game uses* may **shout** it once. Specialising a lane both turns its dial down *and* unlocks the plays of every game that touches it.

### The grid

|          | Tech | Physical | Charm | Stealth |
|----------|------|----------|-------|---------|
| **Tech** | Crack the Tumblers | Follow the Circuit | Inside Knowledge | Safe-Crack |
| **Physical** | — | Beat 16 | Assembly Line | Steady Hands |
| **Charm** | — | — | Categories | Defuse the Alarm |
| **Stealth** | — | — | — | The Once-Over |

### The ten games

**Crack the Tumblers** — *Tech.* Silent coordination (the Mind). Crew silently plays dealt number-cards in ascending order; each correct one is a lock pin falling, a clash trips the alarm. *Replayable:* random cards. *Dial:* fewer cards / wider gaps between values. *Boost:* **Reset Pin** (Tech) — undo one misplay without tripping the alarm; shout it fast.

**Beat 16** — *Physical.* Timing. The app runs a metronome, then mutes it; the nominated cracksman taps the table on the exact target beat. *Dial:* number of beats to count. *Boost:* **In the Bones** (Physical) — two extra audible beats before the mute.

**Categories** — *Charm.* Word recall. The narrator names a category ("getaway cars", "things in a bank vault"); the crew rattles off the target number, no repeats, no hesitation, against a count. *Replayable:* huge category pool. *Dial:* lower target / longer timer. *Boost:* **Skip** (Charm) — swap a category you hate.

**The Once-Over** — *Stealth.* Observation. The narrator lays out ~8–10 cards (the "room"); the crew studies it, it's screened, and one thing changes (swap, flip, remove, rotate). They must spot what changed. *Replayable:* random spread and change. *Dial:* longer study / fewer changes. *Boost:* **Hunch** (Stealth) — the narrator gives a clue (you pitch it at the right level live).

**Follow the Circuit** — *Tech + Physical.* Growing memory sequence (Simon). The app lights a path across a grid of cards; the crew taps it back in order. Each round **the sequence extends by one** — clear the Heat-set length to win, break the chain and it's over. *Replayable:* random sequence. *Dial:* target length / playback speed. *Boost (hold a Tech **or** Physical power-up):* **Photographic** — replay the whole sequence once; shout it fast, once per game.

**Inside Knowledge** — *Tech + Charm.* Pub-quiz trivia (Outsmarted vibe). Rapid-fire questions; the crew confers and answers against the clock. *Replayable:* large question bank. *Dial:* easier tier / fewer questions / more time. *Boost (hold a Tech **or** Charm power-up):* **Narrow It Down** — turn one question into multiple choice for the table; once per game.

**Safe-Crack** — *Tech + Stealth.* Deduction (Mastermind). The crew guesses at a hidden combination; the app feeds back "two digits right, one in place." They reason in over a few attempts before Heat climbs. *Replayable:* random code. *Dial:* fewer digits in play / more guesses / more time. *Boost (hold a Tech **or** Stealth power-up):* **Stethoscope** — reveal one digit's position; once per game.

**Assembly Line** — *Physical + Charm.* Frantic trading (Pit-style), with a cooperative twist. Everyone holds a fixed hand (say 4 cards) and trades **one-for-one only**, so hands stay full and nobody can dump. The goal is for every player to end holding a complete set — but the deal **hides which sets are even in play**: there are exactly enough cards to solve it, yet *not necessarily one of each type*, so the crew doesn't know what they should each be collecting until they read the table and work it out together. Forces the talking, which is the Charm half. *Replayable:* random (always-solvable) deal. *Dial:* hand size / number of types in play / time. *Boost (hold a Physical **or** Charm power-up):* **Tip-Off** — reveal which loot types are actually in play; once per game.

**Steady Hands** — *Physical + Stealth.* Dexterity. Build a card tower to a target height without it toppling, under a timer. Just "can you do it." *Dial:* target height / timer. *Boost (hold a Physical **or** Stealth power-up):* **Extra Hands** — shout it: 10s where everyone, benched included, helps build (the one sanctioned all-hands moment); once per game.

**Defuse the Alarm** — *Charm + Stealth.* Asymmetric info (Keep Talking and Nobody Explodes) — and **the cards literally are the wires.** A row of cards is the bomb; the rules read off card properties — *"if there are two red wires, cut the higher; if a face card shows, cut it last; never cut the aces."* The app shows one player the rulebook (not the table); the rest see the cards (not the rules), so they must call out *"two reds, a jack, a seven"* and get talked through it. "Cutting" = flipping a card face-down. Ticking clock under it all; soft *clip* per safe cut, alarm on a wrong one. *Replayable:* wiring and rules regenerate. *Dial:* simpler rulebook / fewer wires / more time. *Boost (hold a Charm **or** Stealth power-up):* **Clear Channel** — one full spoken sentence allowed through; once per game.

---

## Scaling 2–7 (app-handled, invisible)

The laptop deals an appropriately-sized job; players never see the logic.

- **5–7 players:** full exhaustion (rotation); obstacles need 2–3 crew.
- **4 players:** lighter exhaustion; obstacles need 1–2 crew.
- **2–3 players:** exhaustion softens to a small "tired" penalty next room; obstacles need 1–2 crew.

Mini-games flex to the committed headcount (solo variants where needed); the Getaway scales to the full circle. Exact thresholds are a tuning job for the build. *(Design rule: because benched players only watch, every game must be fast and fun to spectate, and rotation must be brisk so everyone plays often.)*

---

## The narrator (you, on the laptop)

You're *the guy in the van* — flavour that does real work: read the clues, run and referee the games, narrate outcomes, work the soundboard, track Heat/Loot/Gear. The laptop carries everything mechanical; you carry the vibe.

### Narration bank

The app supplies **many variants for every beat** so it never repeats and a coherent heist mood builds across the run — short, punchy, cinematic lines to perform, not paragraphs. Beats that need lines: opening briefing, room clues (per game type), option descriptions, push-or-run prompts, clean/complication/botch quips, scenario set-ups, Getaway intro and countdown, win and busted stings. *Sample tone:* "Camera's down for ten seconds — move." · "That's the easy bit done. Don't get cute." · "Heat's climbing. Car's running if you want it." · "We are NOT clear — go go go!"

### Soundboard

The app surfaces only the buttons relevant to the current moment:

- *Ambient/tension:* ticking clock, low tension drone, heartbeat (high Heat), radio static (the van).
- *Heist SFX:* safe click/clunk, laser hum, keypad beeps, wire snip, door buzz/unlock, glass smash.
- *Stings:* clean success, complication "uh-oh", botch buzzer, cha-ching (loot), gear chime.
- *Danger:* guard footsteps, dog bark, walkie chatter, rising siren (Heat up), full alarm (busted).
- *Finale:* engine rev / tyres screech (clean escape), cell door clang (caught).

---

## The loop in one breath

Van drops a clue → pick an option (loot or gear, hotter or safer) → play the mini-game, shouting boosts → bank the reward, take the Heat → crew rests, table watches → push on or run? → keep grabbing as Heat climbs → call the Getaway and the whole crew races the Articulate deck against your own Heat → escape with a number, or get busted with a smaller one → *again.*

---

## Parked ideas

- **Just One** — excellent co-op word game, but needs writing materials. Held back as a possible Scenario-room or special-event game.

## Open questions / to tune in the build

- The Heat curve — must reliably pressure an escape around the half-hour so greedy crews can't play forever.
- Stat values, Heat thresholds, scaling breakpoints.
- Size of the Gear pool and how it's offered (draft format).
- The Getaway — how Heat maps to cards-to-clear and time (using Articulate cards).
- Each mini-game's solo vs 2–3-player variants.
