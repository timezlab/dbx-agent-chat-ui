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
| `src/app/` | Next App Router entry — `layout.tsx`, `page.tsx`, `providers.tsx` (TanStack Query), `globals.css`; dev-only `api/*/route.dev.ts` mocks. | components, hooks, lib, store |
| `src/components/chat/`, `src/components/shell/` | Chat surface + app shell (sidebar with infinite-scroll history). | hooks, lib, store |
| `src/components/ui/` | shadcn/Radix primitives (`new-york`, neutral, lucide). | `src/lib/utils` |
| `src/entities/` | Zod schemas + inferred types (the wire/data model, incl. `ConversationPageSchema`). | `zod` |
| `src/hooks/chat/` | Chat state hooks — `use-chat`, `use-replay`, `use-history` (React Query). | lib, store, entities |
| `src/hooks/agents/`, `src/hooks/identity/` | Agent-selector + identity-chip hooks. | lib/api, store |
| `src/lib/chat/` | Chat domain — `ChatTransport` + SSE (`transport.ts`), stream reducer, replay, recording. | entities |
| `src/lib/api/` | Capability REST layer — `ApiService` base (axios+zod) + `History`/`Agents`/`Feedback`/`Identity` subclasses. | entities |
| `src/lib/` | Framework-agnostic helpers — `utils.ts` (`cn()`), `config.ts`. | (leaf) |
| `src/store/` | Zustand session store — resolved `config` + persisted `conversationId`/`selectedAgentId` pointers. | lib, entities |
| `src/env.ts` | Typed public env (`NEXT_PUBLIC_*` only; no secrets). | `zod`, `@t3-oss/env-nextjs` |
| `embed/` | Standalone Vite build target for constrained proxy hosts. | shared UI modules |
| `scripts/` | Build/deploy guards — `verify-databricks-output.mjs`, `verify-manual-output.mjs`, `pack-static-output.mjs`. | (node) |

History is backend-only (no `localStorage`): read-only, paginated (`page`/`per_page`),
opened by id. See [`docs/design-docs/state-store-and-no-local-history.md`](./docs/design-docs/state-store-and-no-local-history.md).

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
