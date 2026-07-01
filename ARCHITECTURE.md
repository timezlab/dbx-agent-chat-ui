# Architecture

Repo map for "where does X belong?". For *why* a choice was made, see
[`docs/design-docs/`](./docs/design-docs/).

## Repository layout

| Path | Purpose |
|------|---------|
| `frontend/` | The Next.js app — the only shipping code. Static-export UI. |
| `docs/` | Product direction, ADRs, references, tech-debt tracker (system of record for *why*). |
| `.specify/` | Spec Kit: specs/plans/tasks + `memory/constitution.md` (standing principles). |
| `.claude/`, `.agents/` | Agent rules and skills. `.claude/skills/*` symlink into `.agents/skills/*`. |

The repo root holds planning/docs; **all application code lives under `frontend/`**.

## Frontend module map

App code is under `frontend/src/`. Alias root `@/` → `frontend/src/`.

| Module | Purpose | Depends on |
|--------|---------|------------|
| `src/app/` | Next App Router entry — `layout.tsx`, `page.tsx`, `globals.css`. | components, hooks, lib |
| `src/components/ui/` | shadcn/Radix primitives (`new-york`, neutral, lucide). | `src/lib/utils` |
| `src/hooks/` | Reusable React hooks (e.g. `use-mobile`). | lib |
| `src/lib/` | Framework-agnostic helpers — `utils.ts` (`cn()`). | (leaf) |
| `src/env.ts` | Typed public env (`NEXT_PUBLIC_*` only; no secrets). | `zod`, `@t3-oss/env-nextjs` |
| `embed/` | Standalone Vite build target for constrained proxy hosts. | shared UI modules |
| `scripts/` | Build/deploy guards — `verify-databricks-output.mjs`, `verify-manual-output.mjs`, `pack-static-output.mjs`. | (node) |

### Target modules (planned, not yet built)

Per [`docs/design-docs/deployment-and-limits.md`](./docs/design-docs/deployment-and-limits.md)
(D-011) and [`chat-transport.md`](./docs/design-docs/chat-transport.md), the chat
feature will add:

- `src/components/chat/`, `src/components/layout/` — chat surface + shell.
- `src/hooks/chat/` — chat state / streaming hooks.
- `src/lib/chat/` — `ChatTransport` interface + stream-event reducer.
- `src/lib/databricks/` — transport adapters (responses, chat-completions, static-proxy, mock).
- `src/lib/api/`, `src/lib/stream/` — fetch + SSE plumbing.

## Dependency direction

`app → components → hooks → lib`; `lib` is a leaf (pure, no I/O beyond typed env).
Never reverse. Chat components reach backends **only** through a `ChatTransport`
adapter in `src/lib/` — never fetch an endpoint directly from a component.

## Key boundaries (must stay true)

- **No secrets in the browser bundle.** Only `NEXT_PUBLIC_*`, and only for non-secret endpoint selection.
- **Static-export safe.** No Next route handlers, server actions, cookies, or request-time headers.
- **UI-only.** No backend/BFF, no Databricks auth or credential handling in this repo.
- **Customizable by contract.** Visual tokens stay CSS variables in `src/app/globals.css`; every component forwards `className` through a trailing `cn(...)`; endpoint URL/mode/naming stay in config, never hardcoded. See [`docs/design-docs/customization-and-theming.md`](./docs/design-docs/customization-and-theming.md).

Full rationale for the boundaries: [`docs/design-docs/repo-boundaries.md`](./docs/design-docs/repo-boundaries.md).
