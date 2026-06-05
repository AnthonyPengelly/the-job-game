# ORCHESTRATION.md — the autonomous build pipeline

How The Job gets built: a pipeline of Claude Code agents running in a Docker container (bypass-permissions), producing the whole app in one **big-bang build** before the first human playtest. Designed for three constraints you named:

1. **Cost & context.** Don't run everything on Opus, and never let one agent's context balloon. Each step runs in a **fresh container with a fresh model context**, on the **cheapest model that can do that step well**, against a **small, scoped task**. Durable state lives in git, not in any agent's memory.
2. **Coherence across epics.** A planner decomposes; builders implement one task at a time; **multiple reviewers gate every merge across different concerns**; a QA agent closes each epic. The `docs/` are the shared contract.
3. **Safety despite bypass-permissions.** Agents run in an isolated container on a throwaway clone, push to branches, and **never merge without passing review + sensors + balance + (where relevant) QA**. The human reviews the merged result, not each keystroke.

---

## 1. Roles, models & why

Each role is a separate `claude -p` invocation with its own prompt (`scripts/agents/prompts/*.md`) and its own model. Models are **env vars** (`MODEL_*`) so you tune cost without touching scripts — set them in `.env`. Recommended tiering (cheap → dear):

| Role | Env var | Recommended tier | Why |
|------|---------|------------------|-----|
| **Planner** | `MODEL_PLAN` | strongest (Opus) | Runs **once per epic**, not per task. Decomposition quality compounds, so spend here. Cheap in aggregate (≤13 calls total). |
| **Builder** | `MODEL_BUILD` | mid (Sonnet) | The workhorse — most calls. Sonnet builds well against a tight task spec + good docs. |
| **Code reviewer** | `MODEL_REVIEW` | mid (Sonnet) | Reads a diff against `docs/`; doesn't need top-tier. Escalate to Opus only on repeated ISSUES (see §4). |
| **Game-design reviewer** | `MODEL_REVIEW` | mid (Sonnet) | Checks the diff against the fixed design + rigour. Same tier. |
| **QA agent** | `MODEL_QA` | mid (Sonnet) | Drives the SPA via Playwright MCP; needs reasoning over UI state. |
| **Fixer** | `MODEL_BUILD` | mid (Sonnet) | Same as builder; addresses review/QA findings. |
| **Marker parser** | `MODEL_PARSE` | cheapest (Haiku) | Runs after every agent call to extract `PIPELINE_*` markers from free-form output into a JSON sidecar. Tolerates markdown formatting. Default: `claude-haiku-4-5-20251001`. |
| **Merge/bookkeeping** | — | none (shell) | Deterministic git ops in `lib/common.sh`. No model. |
| **Balance / content checks** | — | none (scripts) | `npm run sim:check`, `npm run content:validate`. Deterministic, free. |

Deterministic gates (sim, content, lint, type, unit tests) are **scripts, not agents** — they're free, fast, and unambiguous. Spend model budget only on judgement.

> Model strings are **not hardcoded** anywhere. `.env.example` ships documented defaults; override per-run. If a tier is too weak for an epic, bump that one env var.

---

## 2. The pipeline (per epic)

```
                         ┌─────────────────────────────────────────────┐
  PLAN (once/epic) ──►   │ tasks E<n>.1 … E<n>.k written to plans/      │
  MODEL_PLAN             └─────────────────────────────────────────────┘
                                          │
                 ┌────────────────────────┼───────────────────────────┐
                 ▼  for each task, in order (small, branch-isolated)   │
        ┌──────────────┐                                               │
        │   BUILD       │  MODEL_BUILD                                  │
        │  branch +     │  → emits PIPELINE_BRANCH: epic/E<n>-task<k>   │
        │  implement +  │                                               │
        │  npm check:full                                              │
        └──────┬───────┘                                               │
               ▼                                                       │
   ┌──────────────────────── REVIEW GATE (all must pass) ───────────┐ │
   │  • deterministic: check:full + sim:check + content:validate    │ │
   │  • code-reviewer (MODEL_REVIEW)          → LGTM / ISSUES        │ │
   │  • game-design-reviewer (MODEL_REVIEW)   → LGTM / ISSUES        │ │
   │    (only runs if the task touches engine/content/minigames)    │ │
   └───────────────┬───────────────────────────┬────────────────────┘ │
          all LGTM │                    any ISSUES                     │
                   ▼                            ▼                       │
            ┌────────────┐            ┌───────────────────┐            │
            │   MERGE     │            │   FIX (MODEL_BUILD)│ ──┐       │
            │ (shell)     │            │  address findings  │   │ loop  │
            │ PIPELINE_   │            └───────────────────┘   │ ≤ N   │
            │  DONE:      │                     ▲───────────────┘       │
            └─────┬──────┘                                              │
                  └──────────────── next task ───────────────────────► │
                 (when all tasks merged)                                │
                                          ▼                             │
                         ┌─────────────────────────────────┐           │
                         │  EPIC QA (MODEL_QA, Playwright)  │ ──┐       │
                         │  drive flows, screenshot, assert │   │ fix   │
                         │  → LGTM / ISSUES                 │   │ loop  │
                         └────────────────┬─────────────────┘  │ ≤ N   │
                                  LGTM    │      ISSUES ────────┘       │
                                          ▼                            │
                            epic done → next epic (dep order) ─────────┘
```

### Stage detail

- **Plan** (`MODEL_PLAN`, once/epic): reads `docs/EPICS.md` for the epic + the relevant `docs/`, writes `plans/E<n>.md` — numbered tasks, each PR-sized (~one module/file-set), with explicit acceptance criteria and dependency order. Emits `PIPELINE_PLAN_DONE: E<n>`.
- **Build** (`MODEL_BUILD`, per task): branches `epic/E<n>-task<k>`, implements *only that task*, runs `npm run check:full`, commits, pushes. Emits `PIPELINE_BRANCH: <branch>` or `PIPELINE_BLOCKED: <why>`.
- **Review gate:** the runner first runs the **deterministic gates** (fast, free). If they fail, route straight to Fix without spending a reviewer. If they pass, run the **code reviewer** always, and the **game-design reviewer** only when the diff touches design-bearing *source* under `src/engine`, `src/content`, `src/minigames`, or `presets/` — diffs that only add tests (`*.test.*`, `__tests__/`) or type declarations (`*.d.ts`) under those paths don't change game design and skip the second reviewer. Each reviewer emits `PIPELINE_STATUS: LGTM|ISSUES` + findings. Once a reviewer says LGTM it is not re-run on subsequent fix rounds.
- **Fix** (`MODEL_BUILD`): receives the concatenated findings, pushes fixes to the same branch. Re-enter the review gate — but a reviewer that already returned LGTM is **not re-run**; only the reviewer(s) that flagged issues re-run, while the free deterministic gates re-run every round to catch any regression a fix introduces. **Bounded:** `MAX_REVIEW_ROUNDS` (default 3). On exhaustion → `PIPELINE_BLOCKED` and the epic pauses for the human.
- **Merge** (shell): only when every gate is LGTM. Fast-forward/squash-merge the branch, archive the review notes, emit `PIPELINE_DONE: <branch>`.
- **Epic QA** (`MODEL_QA`, after all tasks merged): starts the dev server, drives full seeded runs via Playwright MCP, asserts the epic's acceptance gate from `docs/EPICS.md` (loop never dead-ends, overrides work, player-view leaks nothing, screenshots key states). ISSUES → a fix task → re-QA, bounded by `MAX_QA_ROUNDS` (default 3).

---

## 3. The big-bang run

`scripts/agents/orchestrate.sh` walks the epics in the **dependency order** from `docs/EPICS.md` (E0→E1→E2→E3→E4→E5, then E6–E9, then E10, E11, E12) and runs the per-epic pipeline for each. It is resumable: because state is in git + `plans/` + the review archive, a crashed or rate-limited run **picks up at the next unmerged task**, never redoing merged work.

- **Sequential by default**, because the critical path is genuinely linear and parallel agents fighting over one repo is where incoherence creeps in.
- **Opt-in fan-out:** E6–E9 (which only depend on E3/E4) may be run as parallel `run-epic.sh` invocations on separate branches once E4 is merged — the script supports it behind a flag, but the safe default is sequential.
- **Rate-limit resilient:** `lib/common.sh` detects limit messages in agent output, parses the reset time, sleeps, and retries — a multi-hour build survives a quota window.

You do **not** run the big bang until preflight passes (§5).

---

## 4. Keeping agents on track (and cheap)

- **Small tasks, fresh context.** Every `claude -p` call is a new process with a clean context window. A task is scoped to ~one module so the builder never needs the whole repo in context — it needs the task spec, the relevant `docs/`, and the files it touches. This is the single biggest lever on both cost and quality.
- **Docs are the shared brain.** Agents don't pass long transcripts to each other. They pass **git branches + short marker lines + review files**. Coherence comes from every agent reading the same `docs/` and `presets/` schema, not from a giant conversation.
- **Escalating review leniency.** Even round 1 raises only findings that change correctness, architecture, type-safety, test integrity, or a genuinely confusing design — pure style/formatting/naming is owned by ESLint/Prettier (the free deterministic gates), never raised as a review finding. By the final round, reviewers tighten to **hard floors** only (broken tests, design contradiction, dead-end, leaked player state) — this stops infinite nitpick loops. Optionally bump `MODEL_REVIEW`→Opus on the final round for a decisive call.
- **Deterministic gates first.** Never spend a reviewer on a diff that fails `check:full`/`sim:check`/`content:validate`. Cheap checks gate expensive ones.
- **Bounded loops.** `MAX_REVIEW_ROUNDS` and `MAX_QA_ROUNDS` cap spend; exhaustion blocks for a human rather than burning budget.
- **The QA agent stays on rails** by scripting *what* to verify (the epic's acceptance gate) rather than "explore freely." Playwright MCP runs against a **seeded** app so flows are reproducible and screenshots are diffable.

---

## 5. Markers (the only inter-step protocol)

Agents communicate completion via terminal marker lines the runner greps for. **Emit exactly one, last, on its own line.**

| Marker | Emitted by | Meaning |
|--------|-----------|---------|
| `PIPELINE_PLAN_DONE: E<n>` | planner | `plans/E<n>.md` written |
| `PIPELINE_BRANCH: <branch>` | builder/fixer | work pushed to `<branch>` |
| `PIPELINE_STATUS: LGTM` | reviewer/QA | approved |
| `PIPELINE_STATUS: ISSUES` | reviewer/QA | findings follow above the marker |
| `PIPELINE_DONE: <branch>` | merge step | merged |
| `PIPELINE_BLOCKED: <reason>` | any | needs a human; pipeline pauses |

The runner parses only these. Everything else in agent output is logged to `pipeline-logs/` for the human, never acted on.

---

## 6. Safety model (bypass-permissions)

- The container is **isolated**: a fresh shallow clone, no host mounts of your real machine, scoped secrets via env only.
- Agents have full tool access *inside the container* but the only way work leaves is a **pushed branch that survived all gates**. Merges are done by the deterministic shell step, not by an agent deciding it's done.
- `PIPELINE_BLOCKED` is a first-class outcome — agents are told to block rather than guess on anything not covered by `docs/`. Guessing is the failure mode; blocking is success.
- The human reviews the **merged, gated result** and plays it. Nothing auto-deploys.

---

## 7. Preflight (test the setup before the big bang)

`scripts/agents/preflight.sh` validates the whole rig **without building the app** — run it until green before `orchestrate.sh`:

1. Docker image builds; `claude` is on PATH inside it; auth resolves (`CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`).
2. `git` + `gh` (if used) authenticate; the throwaway clone works.
3. Playwright MCP starts and can open a page.
4. The marker-parsing in `lib/common.sh` passes its self-test (feed it canned agent output, assert it extracts the right marker).
5. A **one-shot smoke task**: invoke the builder on a trivial throwaway task (e.g. "add a comment to README on a scratch branch") on the cheapest model, and confirm the full build→review→merge marker flow runs and the branch lands. Then delete the scratch branch.
6. Print a readiness checklist; exit non-zero if anything fails.

Only when preflight is green do you launch the big bang. See `docs/WAYS-OF-WORKING.md` for the human run-book.

---

## 8. Learning across steps

When the same class of problem appears twice, agents follow the harness-improvement protocol (from `CLAUDE.md`): **Inform** (update the relevant `docs/` guide), **Verify** (add a sensor/lint/test that catches it), **Correct** (a codemod where possible), and log it in `HARNESS_CHANGELOG.md` with date + trigger + change. The planner reads recent changelog entries when decomposing the next epic, so lessons propagate forward without bloating context.
