# Docs-as-Code

The repository is the system of record. If a decision, plan, or constraint isn't in the repo, it doesn't exist for the agent.

- **Plans live in Spec Kit**, not `docs/exec-plans/`. This project uses GitHub Spec Kit (`.specify/`) as the system of record for specs and plans. Before starting any feature with ≥3 tasks: create or update `plan.md` + `tasks.md` in `.specify/specs/NNN-<short-name>/` (alongside `spec.md`). One feature folder owns its plan and tasks — consolidate related workstreams into that feature's `plan.md`/`tasks.md` rather than scattering separate plan files. See the `spec-driven` rule for the workflow.
- Plan/task entries must be committable units with observable done conditions — not week/phase buckets
- Any architectural decision worth disagreeing about: write an ADR in `docs/design-docs/` with Context, Decision, Alternatives, and Consequences (Better / Worse / Must now be true)
- After a refactor, stale docs are actively harmful — grep for old names across docs and code references until only intentional hits remain (see skill for the full surface list)
- Completed plans are historical record: annotate with a dated note, never rewrite the body
- `AGENTS.md` is a table of contents, not an encyclopedia — target ~100 lines, hard ceiling 150

Invoke the `docs-as-code` skill for general templates and the reference library (doc-structure, design-doc, agent-readable, agents-md, freshness-refactor). **Note**: where that skill says `docs/exec-plans/active/`, this project instead uses `.specify/specs/NNN-<name>/` (Spec Kit) — the skill's exec-plan location is superseded here.
