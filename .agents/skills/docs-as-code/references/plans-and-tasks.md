# Plans & Tasks (Spec Kit)

This project uses **GitHub Spec Kit** (`.specify/`). A feature's plan and tasks are living documents for work in progress — `plan.md` (how) and `tasks.md` (the checklist), both under `.specify/specs/NNN-<short-name>/` alongside `spec.md` (what & why). Their job: let any agent (human or AI) resume the work mid-stream without a meeting.

The baseline benchmark showed that agents without this skill default to **week/phase organization** (Week 1, Week 2...). That looks reasonable to a human skimming, but it's hostile to an agent mid-sprint: there's no committable unit to pick up, no explicit done condition, no record of why decisions were made. This reference exists to counter that default — it governs the *quality bar* for `tasks.md`, which `/speckit-tasks` generates and you refine.

---

## Spec-first gate (Spec Kit enforces this)

`plan.md`/`tasks.md` answer **what gets built and in what order**. They do not answer **why this shape and not another** — that's `spec.md` (and, for cross-cutting decisions, an ADR in `docs/design-docs/`). The Spec Kit flow makes this an ordering rule, not an optional one:

1. `spec.md` first (`/speckit-specify`) — goal, acceptance, non-goals. Inherits the constitution (`.specify/memory/constitution.md`).
2. `plan.md` next (`/speckit-plan`) — the technical shape.
3. `tasks.md` last (`/speckit-tasks`) — committable units derived from the plan.

If a non-trivial technical decision needs its own rationale doc, write an ADR (see `design-doc.md`) and reference it from `plan.md`. A decision is non-trivial if any of these are true: it creates an invariant other code must respect, reasonable engineers would disagree, or you'd be annoyed if someone undid it without talking to you.

If the work is genuinely small (single committable unit, no architectural choice), the Fast lane applies — say so explicitly rather than fabricating a spec.

---

## Templates live in Spec Kit

Do not hand-roll a plan template — use the bundled ones, populated by the speckit skills:

- `.specify/templates/spec-template.md` → `spec.md`
- `.specify/templates/plan-template.md` → `plan.md`
- `.specify/templates/tasks-template.md` → `tasks.md`

What each part must earn its place by carrying:
- **Goal / acceptance** (in `spec.md`) — so an agent can judge whether the work is done
- **Background / context** (in `plan.md`) — so resuming requires no external context
- **Decisions** — so reversals don't get lost in git history; cite the ADR path
- **Out of scope** (in `spec.md` non-goals) — so an agent doesn't "helpfully" fix something you deliberately deferred
- **Tasks with observable done conditions** (in `tasks.md`) — the committable-unit rule below

---

## Task granularity — the committable-unit rule

A `tasks.md` entry should correspond to roughly one commit. If "done" requires multiple PRs or multiple days, split it.

**Bad (phase-level):**
> - [ ] Week 1: Implement JWT — token module, signing, verification, refresh tokens

**Good (committable):**
> - [ ] Add JWT signing/verification module (`src/auth/jwt.ts`)
>   - Done when: `signToken()` and `verifyToken()` exported with tests
> - [ ] Add refresh token rotation
>   - Done when: `rotateRefreshToken()` handles reuse detection, tests cover replay case
> - [ ] Wire JWT middleware into Express app
>   - Done when: `/protected` routes reject missing/expired tokens

Why this matters: an agent picking up the work mid-stream reads the checklist and knows **exactly what to commit next**. Phase-level tasks force re-planning on every resume.

**Heuristics for "is this task the right size?":**
- Could I finish it and push a commit today? → probably right
- Does it touch one coherent area? → probably right
- Does describing it require "and"? → split it
- Could two people work on it in parallel without conflict? → split it

**Banned phrasings — rewrite before committing `tasks.md`:**

These phrasings consistently produce tasks an agent cannot pick up. If you catch yourself writing them, rewrite to a concrete deliverable + observable done condition.

| Banned | Why it fails | Rewrite |
|--------|-------------|---------|
| "Implement X module" | No surface, no done condition | "Add `signAccessToken()` and `verifyAccessToken()` in `src/auth/jwt.ts`; tests cover expired / malformed / wrong-signature" |
| "Add appropriate error handling" | "Appropriate" is not testable | "Wrap DB calls in `src/auth/store.ts`; on `UniqueViolation` return `{ ok: false, code: 'duplicate' }`; integration test covers duplicate email" |
| "Handle edge cases" | Which ones? | List them: "Empty input returns 400; missing field returns 422; oversized body (>1MB) returns 413" |
| "Polish / clean up X" | Open-ended; never done | Name the file and the change: "Extract `validatePayload()` from `routes/login.ts`; no behavior change; existing tests still pass" |
| "Investigate / spike X" | Spikes belong in a branch, not a task list | If exploration is needed, write the spike as its own short task: "Spike: 1-day timebox, output is a paragraph in the Decisions section on whether to use library X" |
| "Similar to Task N" | Forces re-reading; rots when N changes | Write the task fully. Repetition is cheaper than indirection. |
| "Refactor X for clarity" | "Clarity" is taste; no done condition | State the structural change: "Move `validateEmail()` from `routes/register.ts` to `src/auth/validators.ts`; update 3 call sites" |

The general rule: if the task could mean five different things to five different agents, it's not a task — it's a topic. Topics belong in `plan.md` context, not `tasks.md`.

---

## Done conditions must be observable

"Implement auth" is not a done condition. "`POST /login` returns a JWT on valid creds; integration test passes" is.

Observable = something another agent can verify by reading the code or running a command, without asking the author.

---

## Status lifecycle — annotate in place, don't move

Spec Kit keeps each feature in its own folder `.specify/specs/NNN-<short-name>/` for the life of the repo. There is no active/completed folder move.

When all tasks are checked:

1. Mark the feature done in its `spec.md`/`plan.md` header (e.g. `Status: done`, `Completed: <date>`)
2. Add a one-line summary at the top if the outcome differed from the goal
3. Leave the folder where it is — it's the historical record for that feature

**Do not rewrite** a completed feature's spec/plan/tasks when code later changes. They are historical record. See `freshness-refactor.md` for how to annotate instead.

---

## Tech debt entries

Debt that surfaces during a feature (but isn't worth fixing now) goes in `docs/tech-debt-tracker.md`. One flat file, one entry per item. Agents grep this — keep it scannable.

**Entry format:**

```markdown
## <short title>

- **Where:** `src/auth/jwt.ts:42-58`
- **Symptom:** Token refresh uses setTimeout; not resilient to clock drift or process restart.
- **Why deferred:** Fixing requires a job queue (not yet introduced).
- **Trigger to fix:** When we add a background job runner, migrate this first.
- **Created:** 2026-04-14
```

Required fields:
- **Where** — exact file and line range. Debt without a location is a rumor.
- **Symptom** — what's wrong, in behavioral terms (not "code smells")
- **Why deferred** — so future-you doesn't try to "helpfully" fix it and hit the same wall
- **Trigger to fix** — the event that makes it worth revisiting. Without this, debt accumulates forever.

Line-level quirks also belong here: "Bug workaround at `path/to/file.ts:117` — library X returns `null` instead of `undefined` on empty result; do not 'fix' this check."

---

## When work is bigger than one feature

If work is big enough that one feature folder feels wrong, split by **deliverable**, not by time. Each deliverable gets its own feature folder (`NNN-<name>/`), and a parent feature's `plan.md` references them:

```markdown
## Sub-features
- See `.specify/specs/012-auth-tokens/` — JWT + refresh
- See `.specify/specs/013-auth-2fa/` — TOTP
- See `.specify/specs/014-auth-hardening/` — rate limits, lockout
```

This keeps each `tasks.md` small enough to stay committable-sized. Use `/speckit-analyze` to check cross-artifact consistency once the set exists.

---

## Self-review before declaring tasks ready

Before handing `tasks.md` to anyone (human or agent), walk this checklist. Each item is a failure mode observed in real plans.

- [ ] **Spec exists and is referenced.** `plan.md` cites `spec.md` (and any ADR), or the change is explicitly Fast-lane / mechanical.
- [ ] **Every task has an observable Done when.** "Implement X" is not observable; "endpoint returns 201 on valid input, 409 on duplicate, integration test covers both" is.
- [ ] **No banned phrasings.** Re-scan the task list against the table above. Rewrite any hits.
- [ ] **Files: hint on every task.** A task with no expected touch points forces the next agent to re-discover the architecture.
- [ ] **Non-goals are non-empty.** Empty non-goals (in `spec.md`) means scope creep is unchecked. Even on small features, name 1–2 things you are deliberately not doing.
- [ ] **Tasks cover the stated Goal.** Read the spec's goal, then read `tasks.md`. If the tasks complete, will the goal be true? If not, you're missing tasks (or the goal is wrong).
- [ ] **No task depends on a future task that isn't in the list.** If task 5 needs an "auth library decision" that isn't an earlier task or a referenced ADR, there's a hole.
- [ ] **Decisions seeded.** At least one entry pointing to the spec/ADR — even if it's just "2026-04-14: See `docs/design-docs/<topic>.md` for shape rationale."

This pass takes 2–3 minutes and catches the failures that turn a "good-looking" plan into one that stalls on first contact with another agent.
