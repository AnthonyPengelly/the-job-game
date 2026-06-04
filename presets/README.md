# presets/ — the game as swappable data

Everything tunable about The Job lives here, **not** in the engine. Content,
rules, tuning and scaling are data loaded at boot and swappable without a
rebuild (golden rule 3). The full reference is `docs/CONTENT-AND-TUNING.md`.

## Folder convention

One folder per preset, named by its `id`:

```
presets/
  <id>/
    _meta.json          ← name, version, description, content-pack references (required)
    tuning.json         ← Heat constants · Getaway curve · scoring weights (required)
    scaling.json        ← the 2-7 profiles + per-game minCommit floors (required)
    content/            ← content packs (authored in E2/E5/E7/E8/E9)
      scenarios.json
      gear.json
      narration.json
      banks.json
      sound.json
      roomTemplates.json
```

`_meta.json`, `tuning.json` and `scaling.json` are always present. Content packs
may be omitted from a derived preset — it then inherits them from the base named
in `_meta.extends`.

## Adding a preset

```bash
cp -r presets/default presets/<new-id>
# edit presets/<new-id>/_meta.json: set id, name, description, and (usually)
#   "extends": "default" with "assert": "off" for an experimental preset
# trim to only the packs you changed (delete the rest so they inherit)
# edit the numbers in tuning.json / scaling.json
npm run content:validate            # parse + cross-pack invariants
npm run sim:check -- --preset <new-id>   # headless Monte Carlo on the new numbers
```

Select it at boot with `?preset=<new-id>`, or pick it in the in-app tuning panel
(E11). No rebuild.

## Rules

- **No tunable hardcoded in `src/engine`.** If a number could be retuned at the
  table it belongs in `tuning.json` / `scaling.json`. See the mapping table in
  `docs/CONTENT-AND-TUNING.md`.
- **`default` is sacred.** It is the balance-asserted preset; `npm run sim:check`
  holds it to the design targets and must stay green. Experiment in a clone.
- **Validate before you select.** Malformed presets fail loudly at the boundary
  (Zod), never silently at the table.
