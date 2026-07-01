# Stack, Packages, and UI Conventions

**Status:** accepted
**Date:** 2026-07-01
**Covers:** D-001 (framework), D-007 (package baseline), D-008 (UI convention), D-009 (repo name)

## Context

This repo is a reusable Databricks agent chat frontend. The framework, package
baseline, and component conventions were chosen to match the patterns already in
use across the sibling repos `timezlab`, `specdeck`, and `lakemind/frontend`, so
the code reads the same and dependencies are already battle-tested. See
[`../references/databricks-research.md`](../references/databricks-research.md)
(Local Repo Findings) for the source comparison.

## Decision

### Framework — Next.js App Router (D-001)

Use Next.js with the App Router. Baseline versions:

| Package | Decision |
| --- | --- |
| Package manager | `pnpm@10.28.2` |
| Next.js | `16.2.9` |
| React | `19.2.4` |
| React DOM | `19.2.4` |
| TypeScript | `^5` |
| Node target | compatible with Databricks Apps Node.js `22.16` |

Use `reactCompiler: true` unless a dependency forces disabling it.

### Package baseline (D-007)

Core dependencies:

| Area | Packages |
| --- | --- |
| Framework | `next`, `react`, `react-dom` |
| Styling | `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`, `tailwind-merge`, `clsx`, `class-variance-authority` |
| UI | `radix-ui`, `shadcn`, `lucide-react`, `cmdk`, `vaul` |
| Data | `@tanstack/react-query`, `axios` |
| Streaming | `@microsoft/fetch-event-source` |
| Validation/env | `zod`, `@t3-oss/env-nextjs` |
| Markdown/chat | `streamdown`, `@streamdown/code`, `@streamdown/mermaid` |
| Feedback/toasts | `react-toastify` |
| Manual embed build | `vite`, `@vitejs/plugin-react` |
| Testing | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` |

### UI component convention (D-008)

Use shadcn/Radix conventions close to `specdeck` (`new-york` style, neutral base,
lucide icons):

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Keep the standard `cn()` helper:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Repository name (D-009)

Use `dbx-agent-chat-ui`. `dbx` is compact but clearly Databricks; `agent-chat-ui`
describes the product surface; it is lowercase-with-hyphens, matching Databricks
custom app naming rules and short enough for package/app/URL names. Do not encode
sensitive customer/workspace/project information in the app name.

## Alternatives considered

- **AI SDK as a hard dependency** — rejected for v1. Databricks' official template
  uses it, but the local repos already have a simpler streaming stack that works
  in static mode. Revisit if a concrete workflow needs it.
- **`next-auth`** — avoided unless the app must support non-Databricks auth outside
  Databricks Apps (auth is out of scope — see
  [`repo-boundaries.md`](./repo-boundaries.md)).
- **`sonner` for toasts** — rejected in favor of `react-toastify` unless an existing
  component explicitly requires it.
- **`express`/backend frameworks** — rejected; this is a UI-only repo.
- **Heavy editor/data packages** (Monaco, JupyterLab, dnd-kit, Recharts) — deferred
  until a concrete chat workflow needs them.

## Consequences

**Better:**
- Code, dependencies, and component conventions match sibling repos — low ramp cost.
- shadcn/Radix + Tailwind v4 gives a large, consistent component library out of the box.

**Worse:**
- Pinned baseline versions must be kept current deliberately; Next 16 / React 19 are recent.
- Avoiding the AI SDK means owning the streaming reducer ourselves (see
  [`chat-transport.md`](./chat-transport.md)).

**Must now be true:**
- Package manager is `pnpm`; commit `pnpm-lock.yaml`.
- New UI primitives follow the shadcn `new-york` + neutral + lucide convention and the `cn()` helper.
- Do not add `express`, `next-auth`, `sonner`, or heavy editor/data packages without a decision update.

## Revisit if

A concrete chat workflow needs the AI SDK, a non-Databricks auth path, or a heavy
data/editor package that the deferred list currently excludes.
