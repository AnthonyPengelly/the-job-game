# design-system/redesign/ — the cockpit redesign screen set

This folder holds the **output of the Claude Design web pass** described in
`docs/FRONTEND-REDESIGN-BRIEF.md`: the redesigned screens (and their variants) for the GM console +
player-view, as **high-fidelity static HTML artifacts**. This screen set is the **input spec for
Epic E13** (`docs/EPICS.md`).

It sits beside `design-system/ui_kits/` because it's the same kind of thing — illustrative, branded
HTML you lift patterns from, not production code. Once E13 ships, the winning patterns can be folded
back into `ui_kits/` and this folder retired.

## What goes here

**Whatever the designer produces** — just drop the exported artifacts in. **Filenames don't matter;
nothing in the build relies on them.** The artifacts should *collectively* cover the screens and
variants in the brief's **"Screens to produce"** manifest, and each artifact should label its screen
and variant in-canvas (which the prompt already asks for) so it maps back to the spec.

An `index.html` gallery linking the artifacts is a nice-to-have, not required. Any exported assets
can live under `assets/`.

## Constraints (same as the brief)

Honour `design-system/colors_and_type.css` and `design-system/README.md` exactly — no new tokens, no
recolouring, the two voices quarantined, Lucide stroke icons, dark-first. Verify against the
specimens in `design-system/preview/*`.
