# WAYS-OF-WORKING.md

How agents (and the human operator) work in this repo. Short and enforced.

## Branching

- One task = one branch = one merge. Branch names: `epic/<EPIC>.<task>` (e.g. `epic/E5.3`). QA fix branches: `epic/<EPIC>-qa-fix-<n>`.
- Branch off the latest `main`. Never build directly on `main`.
- The **merge is done by the deterministic shell step**, never by an agent. An agent's job ends at "pushed and approved".

## Commits

- Small, logical commits. Conventional style: `feat(engine): add escalation ramp`, `test(minigames): cover Safe-Crack dial`, `fix(console): undo restores prior heat`, `chore`, `docs`.
- The branch must be green (`npm run check:full`) before the builder/fixer emits its branch marker.

## Definition of done (a task)

1. Implements exactly its task from `plans/<EPIC>.md` — no more, no less.
2. `npm run check:full` passes; design-bearing changes also keep `sim:check` and `content:validate` green.
3. Honours all golden rules (`CLAUDE.md`): pure engine, presets-as-data, determinism, GM-override/no-dead-ends, player-view isolation, the MiniGame contract, TS strict.
4. Code review **and** (if design-bearing) game-design review return `LGTM`.

## Definition of done (an epic)

All its tasks merged **and** the epic QA pass (`docs/EPICS.md` acceptance gate + cross-cutting invariants) returns `LGTM`. The orchestrator then writes `.orchestrator/done/<EPIC>`.

## Pipeline markers (emit exactly one, last, on its own line)

| Marker | Who | When |
|--------|-----|------|
| `PIPELINE_PLAN_DONE: <EPIC>` | planner | plan written |
| `PIPELINE_BRANCH: <branch>` | builder/fixer | work pushed |
| `PIPELINE_STATUS: LGTM` / `ISSUES` | reviewer/QA | verdict |
| `PIPELINE_DONE: <branch>` | merge step | merged |
| `PIPELINE_BLOCKED: <reason>` | any | needs a human |

**Blocking is a success, not a failure.** If a decision isn't covered by the docs, emit `PIPELINE_BLOCKED` with the precise question rather than guessing. Guessing is the only real failure.

## Harness improvement (when something bites twice)

Inform (update the relevant `docs/` guide) → Verify (add a sensor/lint/test) → Correct (codemod where possible) → log in `HARNESS_CHANGELOG.md`.

---

## Operator run-book (the human, on the host)

You run this from the host; the agents run in the container. **Do not launch the big bang until preflight is green.**

```bash
# 0. one-time: create the empty GitHub repo, copy this kit into it, push `main`.
cp -r the-job/* the-job/.[!.]* <your-new-repo>/ && cd <your-new-repo>
git init && git add -A && git commit -m "chore: seed build harness" && git push

# 1. configure
cp .env.example .env        # fill GITHUB_REPO, a token or gh, an auth token, model tiers

# 2. build the box
docker compose build agent

# 3. PREFLIGHT — run until green (checks 1–4, no model spend)
RUN=preflight docker compose run --rm agent
# then the real smoke (one cheap agent call end-to-end through build→merge):
RUN=preflight SMOKE=1 docker compose run --rm agent

# 4. (optional) prove ONE epic before committing to the whole run
RUN="epic E0" docker compose run --rm agent

# 5. THE BIG BANG — build everything, dependency order, resumable
RUN=orchestrate docker compose run --rm agent
# if it pauses on a BLOCK or rate window, resolve, then resume:
START_AT=E5 RUN=orchestrate docker compose run --rm agent
```

Logs and QA screenshots land in `./pipeline-logs/` on the host. When all epics are complete the orchestrator prints `ALL EPICS COMPLETE`; pull `main`, `npm install`, `npm run dev`, and playtest.
