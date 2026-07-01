# dbx-agent-chat-ui

A reusable, UI-only frontend chat app for Databricks agents. One static build serves
notebook/proxy hosting, Databricks Apps, and manual-copy deployment.

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · pnpm · Tailwind v4 ·
shadcn/Radix · TanStack Query · `@microsoft/fetch-event-source` · `streamdown`.
App code lives under `frontend/`.

## Key principles (do not violate)

- **No secrets in the browser bundle** — only `NEXT_PUBLIC_*`, for non-secret endpoint selection.
- **UI-only** — no backend/BFF, no Databricks auth or credential handling in this repo.
- **Static-export safe** — the shipped `output: "export"` artifact has no Next route handlers, server actions, cookies, or request-time headers. (One exception: a **dev-only** mock route `app/api/chat/route.dev.ts`, gated out of `next build` via `pageExtensions`, so it never reaches the static export. See [`docs/design-docs/dev-mock-endpoint.md`](./docs/design-docs/dev-mock-endpoint.md).)
- **Backends only via a `ChatTransport` adapter** — components never fetch an endpoint directly.
- **Customization is a contract** — theme via CSS variables, every component forwards `className`, and endpoint URL/mode/naming are config, never hardcoded. See [`docs/design-docs/customization-and-theming.md`](./docs/design-docs/customization-and-theming.md).
- Full rationale: [`docs/design-docs/repo-boundaries.md`](./docs/design-docs/repo-boundaries.md).

## Conventions

- Package manager: `pnpm` (commit `pnpm-lock.yaml`).
- UI: shadcn `new-york` + neutral + lucide; use the `cn()` helper.
- Commits / branches / tests: see `.claude/rules/` and the corresponding skills.
- This project is **spec-driven** — see Docs table before starting scoped work.

## Docs

| When you need to… | Read |
|--------------------|------|
| Understand the structure | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Product direction / MVP scope | [`docs/DESIGN.md`](./docs/DESIGN.md) |
| Understand a decision (why) | [`docs/design-docs/`](./docs/design-docs/) |
| Find / start a feature plan | `.specify/specs/NNN-<name>/` (via speckit skills) |
| Standing principles | [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) |
| Known tech debt / open questions | [`docs/tech-debt-tracker.md`](./docs/tech-debt-tracker.md) |
| Databricks/stack background | [`docs/references/databricks-research.md`](./docs/references/databricks-research.md) |

## Design docs index

- [`stack-and-conventions.md`](./docs/design-docs/stack-and-conventions.md) — framework, packages, UI conventions, repo name.
- [`repo-boundaries.md`](./docs/design-docs/repo-boundaries.md) — static export, UI-only, auth boundary.
- [`customization-and-theming.md`](./docs/design-docs/customization-and-theming.md) — CSS-variable theming, class override, endpoint config.
- [`chat-transport.md`](./docs/design-docs/chat-transport.md) — adapter transport, streaming, markdown.
- [`deployment-and-limits.md`](./docs/design-docs/deployment-and-limits.md) — deploy workflow, repo layout, Databricks limits.

## Structure

See [`ARCHITECTURE.md`](./ARCHITECTURE.md). Application code is under [`frontend/`](./frontend/); the repo root holds planning and docs.
