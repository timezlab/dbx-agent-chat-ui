# Parallel Subagents

When a task splits into 2+ independent domains, or when research would flood main context with noise, dispatch parallel subagents instead of doing it inline.

- Batch Task/Agent calls in **one assistant message** — separate messages run sequentially.
- Every brief must be **self-contained** (the subagent has no memory of this conversation) and must state an **output contract** (exact return shape).
- Do **not** parallelize related failures, shared-file edits, or trivial single lookups.

See `.agents/skills/parallel-agents/` for the full dispatch protocol, briefing template, and failure modes.
