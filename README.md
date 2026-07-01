# dbx-agent-chat-ui

A reusable, **UI-only** frontend chat app for Databricks agents. One static build
targets notebook/proxy hosting, Databricks Apps, and manual-copy deployment. No
backend/BFF and no credential handling live in this repo.

The application code is in [`frontend/`](./frontend/); the repo root holds planning
and documentation.

## Where things live

| Looking for… | Go to |
|--------------|-------|
| The app | [`frontend/`](./frontend/) |
| Product direction & MVP scope | [`docs/DESIGN.md`](./docs/DESIGN.md) |
| Architecture / module map | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Why decisions were made (ADRs) | [`docs/design-docs/`](./docs/design-docs/) |
| Open questions & tech debt | [`docs/tech-debt-tracker.md`](./docs/tech-debt-tracker.md) |
| Databricks/stack research | [`docs/references/databricks-research.md`](./docs/references/databricks-research.md) |
| Working in this repo as an agent | [`AGENTS.md`](./AGENTS.md) |
| Specs, plans, tasks | `.specify/specs/` (GitHub Spec Kit) |

## Status

v1 / MVP in progress — single streaming chat screen. See
[`docs/DESIGN.md`](./docs/DESIGN.md) for scope and non-goals.
