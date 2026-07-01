# Product Direction

**Status:** in-progress (v1 / MVP)
**Last updated:** 2026-07-01

## What this is

A maintainable, reusable frontend chat app for Databricks agents. The same UI must
support multiple deployment targets from one static build:

- **Static notebook/proxy hosting** — only HTML, CSS, and JavaScript assets can be served.
- **Databricks Apps (or another wrapper)** — an external runtime serves the exported frontend and provides any backend/API/auth layer, outside this repo.
- **Manual-copy deployment** — generated zip/embed artifacts when Git or direct sync is unavailable.

This repo is **UI-only**: it builds static frontend assets and does not include a
backend/BFF. The boundary is a firm decision — see
[`design-docs/repo-boundaries.md`](./design-docs/repo-boundaries.md).

## v1 / MVP scope (D-014)

Build the first version around:

- Single chat screen.
- Streaming assistant responses.
- Cancel generation.
- Markdown/code rendering.
- Tool-call/timeline placeholder surface.
- Error display.
- Optional feedback buttons with a no-op/mock handler.
- Runtime endpoint mode switch via public config.

## Non-goals (deferred past v1)

- Persistent history in Lakebase.
- MLflow feedback logging.
- Multi-agent routing UI.
- File/image/multimodal inputs.
- Advanced SQL/table/chart rendering.
- NextAuth or external IdP integration.

Authentication, credential handling, and any server runtime are **permanently** out
of this repo's scope, not just deferred — see
[`design-docs/repo-boundaries.md`](./design-docs/repo-boundaries.md).

## Customization (a core capability, not a v1 nice-to-have)

Because this is a reusable UI, every consuming host must be able to re-skin it and
point it at its own backend **without forking**:

- **Theme** by overriding CSS variables (color / radius / fonts) — no component edits.
- **Override styles** by passing `className` to any component (merged last, wins over defaults).
- **Configure the endpoint** — URL, transport mode, and endpoint *naming/path* are config, not hardcoded constants.

Full contract and invariants: [`design-docs/customization-and-theming.md`](./design-docs/customization-and-theming.md).

## How success is judged

The UI streams a Databricks agent conversation end-to-end against a mock transport
with zero Databricks access, and the same static build deploys to a notebook/proxy
host and a Databricks Apps wrapper without code changes — only public endpoint
config differs.

## Where the decisions live

| Topic | Doc |
|-------|-----|
| Framework, packages, UI conventions | [`design-docs/stack-and-conventions.md`](./design-docs/stack-and-conventions.md) |
| Static-export / UI-only / auth boundary | [`design-docs/repo-boundaries.md`](./design-docs/repo-boundaries.md) |
| Theming, class override, endpoint config | [`design-docs/customization-and-theming.md`](./design-docs/customization-and-theming.md) |
| Chat transport, streaming, markdown | [`design-docs/chat-transport.md`](./design-docs/chat-transport.md) |
| Deployment, repo layout, Databricks limits | [`design-docs/deployment-and-limits.md`](./design-docs/deployment-and-limits.md) |
| Open questions / unknowns | [`tech-debt-tracker.md`](./tech-debt-tracker.md) |
| Background research | [`references/databricks-research.md`](./references/databricks-research.md) |
