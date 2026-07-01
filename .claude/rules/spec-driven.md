# Spec Driven (GitHub Spec Kit)

This project uses **GitHub Spec Kit** (`.specify/`) for Spec-Driven Development. Before planning or implementing any feature, API change, refactor, or other scope-sensitive work:

1. **Constitution first.** Read `.specify/memory/constitution.md` for the project's standing principles, coding standards, and constraints (the Project Context every Spec inherits).
2. **Create Spec → Plan → Tasks** under one feature folder `.specify/specs/NNN-<short-name>/` (e.g. `001-review-pipeline`), using the templates in `.specify/templates/`:
   - `spec.md` — *What & Why* (goal, acceptance, non-goals)
   - `plan.md` — *How* (technical shape)
   - `tasks.md` — committable-unit checklist
3. **Drive it with the speckit skills:** `/speckit-constitution` → `/speckit-specify` → (`/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Write and finish `spec.md` before `plan.md`; decompose `plan.md` into `tasks.md` before coding.
4. **Hard gate — never code first.** Do not change source until `spec.md` and `plan.md` exist (or are updated) for the change and the user has approved them. If a change is mechanical enough to skip the spec, say so explicitly.

For *spec quality* (what a good spec must answer, scope boundaries, observable acceptance, separating settled decisions from open questions), invoke the `spec-driven` skill. This rule covers the Spec Kit *workflow*; that skill covers the *content bar*.
