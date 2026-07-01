---
name: parallel-agents
description: Protocol for dispatching parallel subagents — invoke when a task splits into 2+ independent domains, when research would flood main context with noise, or when the user says "in parallel", "fan out", "spawn agents", "delegate", "split this up". Run this before firing Task/Agent tool calls so the brief, scope, and output contract are right the first time.
---

# Parallel Subagents

Subagents are isolated Claude instances with their own context window. Use them to keep noise out of the main conversation and to run independent work concurrently. Used well, they cut wall-clock time and preserve context. Used badly, they burn tokens on overlapping work or return prose nobody can integrate.

---

## When to parallelize

Dispatch parallel agents when **all** of these hold:

- **2+ independent domains.** No shared state, no sequential dependencies. Different files, different subsystems, different questions.
- **Work is narrowly scoped.** Each agent has one clear goal with a verifiable output.
- **Main context would otherwise drown.** Logs, search dumps, file contents, URL fetches that are noise after the summary.
- **The alternative is slower.** Running three greps across three different concerns sequentially is waste; one dispatch is not.

Good fits:
- "Find all call sites of X, Y, Z" → one agent per symbol
- "Research how libraries A, B, C handle pagination" → one agent per library
- "Audit tests in packages foo/ bar/ baz/" → one agent per package
- Any read-heavy exploration where you'll keep only the summary

---

## When NOT to parallelize

- **Related failures.** Fixing one may fix the rest — investigate together first.
- **Exploratory debugging without a hypothesis.** You don't yet know what to brief them on.
- **Shared files or shared state.** Concurrent edits collide on integration.
- **Trivial single-shot lookups.** One Grep, one Read — delegation overhead exceeds savings.
- **Tasks needing full conversation context.** If you can't transplant the context into a self-contained brief, you can't delegate.

When in doubt, do the first pass yourself. Delegate once the shape of the work is clear.

---

## Briefing a subagent

The agent starts with **zero** memory of this conversation. Brief it like a colleague who just walked into the room.

Every brief must include:

1. **Goal — one sentence.** "Find all Go call sites of `parseManifest` under `internal/` and report file:line."
2. **Context the agent needs.** Paste error messages, file paths, relevant snippets, version pins. Do not reference "the bug we discussed" or "the previous attempt."
3. **Constraints.** What NOT to touch ("read-only", "do not modify production code", "do not bump timeouts to make tests pass").
4. **Output contract.** Exactly what the return value should look like. "Return: bullet list of `file:line` matches, no prose." Without this you get 2000 lines of narration you have to re-parse.
5. **Length cap when appropriate.** "Report under 200 words."

Narrow scope beats ambition. "Fix `agent-tool-abort.test.ts`" is a good brief. "Fix the flaky tests" is not.

---

## Dispatch rules

- **One assistant message, multiple tool calls.** Parallel means concurrent — if you send the Task calls in separate messages, they run sequentially. Batch them.
- **Partition by file or module** when work will write code, so edits don't collide.
- **Match the tool to the job.** Read-only exploration → lighter agent (e.g. Explore). Code modification → general-purpose. Don't hand a research agent write access.
- **No recursion.** Subagents cannot spawn subagents. Don't design plans that assume they can.

---

## After dispatch

- **Verify the work.** Agents make systematic errors that look confident. Re-run the full test suite and spot-check actual file diffs — don't trust the summary.
- **Don't duplicate their work.** If you delegated the grep, don't also grep yourself. That defeats the context-protection reason for delegating.
- **Integrate, don't accumulate.** Extract the one or two facts you need from each report and discard the rest. The point was to keep main context clean.

---

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Agent returns vague prose | No output contract in the brief | Specify the exact return shape |
| Agent "fixes" the wrong thing | Scope too broad | Narrow to one file / one symbol / one question |
| Edits conflict on integration | Agents partitioned by task, not by file | Partition by file/module boundaries |
| Main context still grows | Pasted the full agent report back in | Summarize the result, keep the summary only |
| Sequential delays | Task calls sent across multiple messages | Batch in one assistant message |
| Agent hallucinates prior discussion | Brief referenced conversation context the agent can't see | Make briefs fully self-contained |
