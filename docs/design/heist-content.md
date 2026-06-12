# The Job — Content Library (v0.3)

Companion to the design doc. Holds the draftable content: **Gear** (stat boosts + power-ups) and **Scenarios**.

Shorthand: Heat ↑/↓ = ±2 (small) · ⇈/⇊ = ±4 (big) · Loot +/− · **+stat boost** / **+power-up** = Gear · *info* = reveal/ease the next room · **Roll (lane)** = a lane-weighted attempt (see Scenarios intro). Heat track runs 0–20.

---

# GEAR

> **Playtest wave 2 (2026-06) revisions, recorded as decisions:** each
> catalogue item carries **one fixed thematic name + a one-line blurb**
> (e.g. *Magnetic Soles — +1 Stealth*) instead of a pool of flavour names —
> the card label must match the grant exactly. Obstacle gear drops are
> **lane-decoupled** (the lane is a fresh seeded draw, not the lane of the
> game just played) and a statBoost drop has a preset chance
> (`gearDrops.bigScoreChance`) to upgrade to the +2 tier. Sell values follow
> a **visible rule**: `perBonusPoint × points + perRoom × roomIndex`, where
> points = magnitude (+1/+2) and a power-up is worth `powerUpPoints`.

## Stat boosts — common, stack, +1 to a lane

Mechanically all "+1 to one lane." One thematic name per item so the card always reads as what it grants; the crew assigns each to a player and picks the lane where relevant.

- **Tech +1** — *Burner Laptop*
- **Physical +1** — *Grippy Gloves*
- **Charm +1** — *Tailored Suit*
- **Stealth +1** — *Magnetic Soles*

**Big Score (+2 to a lane)** — rare; a windfall. *Zero-Day Cache (Tech) · Stunt Double's Rig (Physical) · The Cover Story (Charm) · Ghost Protocol (Stealth).*

## Power-ups — the four lane abilities

There are exactly **four power-ups — one per lane: Tech, Physical, Charm, Stealth.** Holding one means *"you're an ace at that lane's games."* Whenever a game uses that lane, the power-up gives you a **game-specific effect** — shout to use it, once per game.

- **Rare**, and **one per lane per player** — a player can hold up to four (one of each); they don't stack.
- Different flavour items (Hacker's Rig, Burner Phone, Skeleton Key…) may all grant the **same** power-up — mechanically identical.
- In a **combo game**, holding **either** of its two lane power-ups unlocks that game's one ability (revised v0.9 — *not* a different effect per lane).

### What each power-up does, per game

> **Revised v0.9 (E18):** each *game* has **one** signature ability, triggered by holding a power-up in
> **any lane the game uses**. The old per-lane dual boosts are collapsed; *Muscle Memory, Cheat Sheet,
> Patient Touch, Quick Hands, Steady Breath and Spare Wire are retired.*

| Game | Lane(s) | The game's one ability (hold a power-up in any listed lane) |
|------|---------|--------------------------------------|
| Crack the Tumblers | Tech | **Reset Pin** — undo a misplay, no alarm |
| Beat 16 | Physical | **In the Bones** — two extra audible beats before the mute |
| Categories | Charm | **Skip** — swap a category |
| The Once-Over | Stealth | **Hunch** — the narrator gives a clue |
| Follow the Circuit | Tech + Physical | **Photographic** — replay the whole sequence once |
| Inside Knowledge | Tech + Charm | **Narrow It Down** — turn one question into multiple choice |
| Safe-Crack | Tech + Stealth | **Stethoscope** — reveal one digit's position |
| Assembly Line | Physical + Charm | **Tip-Off** — reveal which loot types are in play |
| Steady Hands | Physical + Stealth | **Extra Hands** — 10s, everyone (benched included) helps build |
| Defuse the Alarm | Charm + Stealth | **Insulated Gloves** — the first wrong cut doesn't trip the alarm (wave 3; *Clear Channel* retired — talking restrictions were unrefereeable, undoing a snip is a table moment) |

So a Tech specialist's single power-up shows up as Reset Pin, Photographic, Narrow It Down, or Stethoscope depending on the room — one ability, many faces.

---

# SCENARIOS

Read the set-up aloud, offer the two choices, then reveal what happens — pick blind, that's the point. Outcomes vary in currency: Heat, Loot, **Gear** (a stat boost or a power-up), *info*, or a delayed payoff.

**Setting.** Every job is a **rich person's mansion** — keep narration consistent with that (no banks or museums mid-run); vary only the dressing in the opening briefing (a Riviera villa, a country estate, a city penthouse).

**Rolls.** Where an option says **Roll (lane)**, the crew first picks *which player attempts it*, and the app rolls success weighted by that player's rating in the named lane — **but we never tell them the lane or the odds.** The flavour hints it ("tiptoe" smells Stealth, "sweet-talk" smells Charm), so a sharp crew sends the right specialist and a careless one sends the wrong one. Higher stat = better odds, never a guarantee. Outcomes below read **success / failure**.

**1. The Inside Man.** A nervous clerk offers to help — for a cut.
- Pay him off → −Loot, **+power-up** (he slips you a keycard).
- Lean on him → **Roll (Charm):** he helps for free (**+power-up**) / he bolts (Heat ↑).

**2. Unmarked Van.** A van idles in the alley, keys in it.
- Hotwire it → **Roll (Tech):** a clean getaway route (Heat ↓) / the alarm chirps (Heat ↑).
- Leave it → nothing.

**3. The Sleeping Dog.** A guard dog dozes across the corridor.
- Tiptoe past → **Roll (Stealth):** clean (Heat ↓) / it wakes (Heat ↑).
- Toss it your lunch → −small Loot, quiet (Heat ↓).

**4. Champagne Room.** The cellar's open, full of vintages.
- Pocket a bottle → Loot +, Heat ↑.
- Stay disciplined → Heat ↓.

**5. The Fuse Box.** The building's electrics, exposed.
- Cut the power → **Roll (Tech):** cameras dead (Heat ⇊) / trips the backup (Heat ↑).
- Leave it → nothing.

**6. Old Friend.** A former crewmate is casing the same joint.
- Team up → Loot + later, but they're sloppy (Heat ↑).
- Send them off with a tip → −small Loot; they owe you (**+power-up**).

**7. The Other Safe.** A smaller safe in the corner, not on the plan.
- Crack it → **Roll (Tech):** Loot + / fumbled and noisy (Heat ↑).
- Leave it → Heat ↓ (stay on task).

**8. Cleaning Crew.** Real janitors, working late.
- Grab a uniform → **+stat boost** (Charm or Stealth — a disguise).
- Hide and wait → Heat ↓.

**9. Dropped Wallet.** A wallet on the floor.
- Take the cash → +small Loot.
- Wipe it and leave it → Heat ↓ (no traces).

**10. The Scanner.** A police frequency, crackling.
- Listen in → **Roll (Tech):** *info* (reveal & ease the next room) / static and frayed nerves (Heat ↑).
- Keep moving → nothing.

**11. Loose Floorboard.** Something's stashed beneath.
- Pry it up → **Roll (Physical):** jackpot (Loot ++) / nailed shut, a racket (Heat ↑).
- Leave it → nothing.

**12. Cold Feet.** A crew member wants out.
- Talk them round → **Roll (Charm):** they rally (**+power-up**) / they walk (Heat ↑).
- Cut them loose → Heat ↓, −small Loot share.

**13. Headlights.** The mark's car turns into the drive.
- Slip out the back → **Roll (Stealth):** unseen (Heat ↓) / spotted (Heat ↑).
- Play it cool as staff → **Roll (Charm):** sold the cover (Heat ↓) / they get suspicious (Heat ↑).

**14. Forgotten Kit.** A workman's tool bag, abandoned.
- Grab it → **+stat boost** (lane of choice).
- Leave it, might be watched → Heat ↓.

**15. Bent Cop.** An officer offers to look the other way.
- Bribe him → −Loot, Heat ⇊.
- Refuse → nothing.

**16. The Gallery.** Priceless canvases line the hall.
- Cut one out → **Roll (Stealth):** a clean lift (Loot ++) / the alarm trips (Heat ⇈).
- Photograph them for the fence → +small Loot.

**17. Server Room.** The security footage, yours to wipe.
- Wipe it → **Roll (Tech):** footage gone (Heat ⇊) / you trip a flag (Heat ↑).
- Leave it → nothing.

**18. The Distraction.** You could stage a commotion across the floor.
- Pull it off → **Roll (Charm):** eyes elsewhere, grab Loot + (Heat ↓) / it backfires (Heat ↑).
- Don't risk it → nothing.

**19. Locked Briefcase.** A sealed case, clearly valuable, tamper-locked.
- Take it along → it ticks Heat ↑ each room it's carried, but **unlocks after 3 rooms → Loot ++**. Escape before then and it's wasted — a bet on how long you'll stay in.
- Leave it → nothing.

**20. Spilled Jewels.** A tray of gems scatters across the marble.
- Scramble for the lot → **Roll (Physical):** grabbed it all (Loot ++) / dropped most, noisy (Loot +, Heat ↑).
- Grab a handful → +small Loot.

**21. The Honest Guard.** One who can't be bought.
- Overpower him → **Roll (Physical):** subdued, path clear (Heat ↓) / a struggle (Heat ↑).
- Slip past unseen → **Roll (Stealth):** clean (Heat ↓) / spotted (Heat ↑).

**22. Blueprints.** Building plans on a desk.
- Study them → the **next room runs an easier dial**, but Heat ↑ (you linger).
- Pocket and sell them → +Loot.

**23. The Home Office.** A leather-topped desk and a wall safe behind a portrait.
- Crack the wall safe → **Roll (Tech):** Loot + / Heat ↑.
- Pocket the desk cash → +small Loot.

**24. The Split.** Unaccounted cash, found mid-job.
- Share it evenly → Loot +, **+stat boost** to a player (morale).
- Pocket it quietly → Loot +, Heat ↑, but a sly **+power-up** for the one who palms it.

**25. Recognised.** Someone clocks a crew member's face.
- Pay for silence → −Loot.
- Lean on them → **Roll (Charm):** they fold (nothing) / they call it in (Heat ↑).

**26. The Mark's Study.** Trophies, a humidor, a personal safe.
- Go for the safe → **Roll (Tech):** blackmail leverage (**+power-up**) / Heat ↑.
- Pocket a cigar and go → +small Loot.

**27. The Tripwire.** A wire glints across the doorway.
- Step over it → **Roll (Physical):** clean / you clip it (Heat ↑).
- Disarm it → **Roll (Tech):** safe and silent (Heat ↓) / Heat ↑.

**28. The Charity Gala.** The ballroom's hosting a black-tie party — crowds everywhere.
- Work the room → **Roll (Charm):** blend in, lift a wallet (Loot +) / someone's suspicious (Heat ↑).
- Skirt the edges → Heat ↓.

**29. A Friendly Face.** A guard greets a crew member like an old colleague.
- Chat them up → **Roll (Charm):** waved through (Heat ↓, *info*) / they grow wary (Heat ↑).
- Avoid them → nothing.

**30. The Dumbwaiter.** A tiny service hatch between floors.
- Send your smallest through → **Roll (Stealth):** retrieve a stash (Loot +) / stuck and panicking (Heat ↑).
- Leave it → nothing.

**31. Counterfeit Stack.** Cash that looks a little too crisp.
- Grab a bundle → **Roll (Stealth):** you pick the real one (Loot +) / you grab fakes (nothing).
- Leave it → Heat ↓.

**32. The Wine Steward.** A staffer offers a quiet "tour" for a tip.
- Tip and follow → −small Loot, *info* (reveal the next room).
- Decline → nothing.

**33. Pressure Plate.** The floor ahead looks rigged.
- Pick across it → **Roll (Stealth):** clean / Heat ↑.
- Wedge and disarm it → **Roll (Tech):** disarmed (Heat ↓) / Heat ↑.

**34. The Intercom.** It crackles — someone wants a status check.
- Answer it → **Roll (Charm):** you bluff the all-clear (Heat ⇊) / they get suspicious (Heat ↑).
- Ignore it → nothing.

**35. The Collector's Cabinet.** A wall of small locked drawers, each maybe holding something.
- Force a few → **Roll (Physical):** Loot + / splintering noise (Heat ↑).
- Take the one left ajar → +small Loot.

**36. The Whistleblower.** A staffer offers evidence on the mark — for cover.
- Take it → **+power-up** (leverage), Heat ↑ (they're being watched).
- Stay out of it → nothing.

**37. Glass Display.** A jewel under thick glass.
- Cut the glass → **Roll (Tech):** Loot ++ / Heat ⇈.
- Swap it for a fake → **Roll (Stealth):** Loot ++ and unnoticed (Heat ↓) / Heat ↑.

**38. The Loadout.** An abandoned crew's kit bag.
- Split it among the crew → **+stat boost** to two players.
- Keep it whole for one specialist → **+power-up** to a single player.

**39. Nosy Neighbour.** A resident peers from a doorway.
- Reassure them → **Roll (Charm):** back inside they go (Heat ↓) / they reach for a phone (Heat ↑).
- Duck away → Heat ↓ (but you miss the hall stash — nothing).

**40. The Manager's Keys.** A ring of keys on a hook.
- Pocket them → *info* (the next obstacle is easier — you have access), but Heat ↑ when they're missed.
- Copy and replace → **Roll (Tech):** same access, no Heat / caught fumbling (Heat ↑).

**41. Hidden Compartment.** A painting swings aside to reveal a recess.
- Reach in → **Roll (Physical):** **+power-up** or Loot ++ / it's trapped (Heat ↑).
- Note it and leave → +small Loot (sell the tip-off).

**42. The Driver's Tip.** Your driver radios a warning about the route.
- Reroute on their word → Heat ↓ (dodge a patrol).
- Stick to the plan → **Roll (Stealth):** nothing / Heat ↑.

**43. The Vault Ledger.** A book of where the real valuables sit.
- Study it → *info*, and the next Loot option pays more.
- Tear out a page and run → +small Loot.

**44. Champagne Toast.** The crew's getting cocky mid-job.
- Indulge a moment → Heat ↑, but **+stat boost** (a hit of confidence).
- Keep focused → Heat ↓.

---

## Still to draft (later)
- Obstacle room framings and their option menus (which games, rewards, Heat costs).
- Heat tuning: drip per room, costs per option, and the Heat→Getaway difficulty bands.
- Starter quirks (the free turn-one identity seeds).
