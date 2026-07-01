# Customization: Theming, Class Override, and Endpoint Config

**Status:** accepted
**Date:** 2026-07-01
**Covers:** consumer customization as a first-class capability (theming, class override, runtime endpoint config)

## Context

This repo is a **reusable** chat UI ([`repo-boundaries.md`](./repo-boundaries.md))
consumed by different hosts (notebook proxies, Databricks Apps wrappers, embeds).
Each host needs to make it look like theirs and point it at their own backend
**without forking**. The shadcn/Tailwind stack ([`stack-and-conventions.md`](./stack-and-conventions.md))
already provides the mechanisms; this decision makes them a **contract** — protected
capabilities, not incidental defaults — so a future refactor can't quietly break them.

There is no backend here, so "customization" means build-time/browser-time
configuration only. No server config, no secrets.

## Decision

Consumers customize the UI across three surfaces. Each is a supported, tested contract.

### A. Theming via CSS variables

All visual tokens are CSS custom properties defined in `frontend/src/app/globals.css`
(`:root` + `.dark`) and mapped through Tailwind's `@theme inline`. A consumer
re-themes by overriding these variables in their own stylesheet — no component edits.

- Tokens cover color (`--background`, `--primary`, `--muted`, `--destructive`, sidebar, chart…), `--radius`, and fonts (`--font-sans`, `--font-mono`, `--font-heading`).
- Colors use `oklch()`; overrides should stay in the same space for predictable contrast.
- Dark mode is the `.dark` class variant; consumers may supply their own palette for both.

### B. Class override on every component

Every component accepts `className` and merges it **last** through `cn()`
(`clsx` + `tailwind-merge`), so consumer classes win over defaults without
specificity hacks. Variants come from `class-variance-authority` (`cva`).

- New components MUST forward `className` into the final `cn(...)` call (all 55 current UI primitives already do).
- Components expose stable `data-slot` / `data-variant` / `data-size` hooks for CSS targeting.

### C. Runtime endpoint & transport configuration

Which backend the UI talks to — and what it's called — is configuration, never
hardcoded. Config is read from public env (`NEXT_PUBLIC_*`) and/or a public config
object, resolved once at startup.

- **Selection:** `NEXT_PUBLIC_TRANSPORT_MODE` (`mock` | `static-proxy` | `responses` | `chat-completions`) + `NEXT_PUBLIC_CHAT_ENDPOINT_URL` (see [`env.ts`](../../frontend/src/env.ts)).
- **Naming/shape:** the endpoint **path/route name** (e.g. `/responses` vs a host-specific path) is part of adapter config, not a constant. Differences in event names and request/response field names are absorbed inside the `ChatTransport` adapter ([`chat-transport.md`](./chat-transport.md)) — the UI never hardcodes a vendor path or field name.
- Adding a host with a different endpoint name = config (or a new adapter), not a UI code change.

## Alternatives considered

- **Hardcoded theme + fork to re-skin** — rejected; defeats "reusable UI" and creates drift across consumers.
- **Prop-drilling style overrides / a `styled` layer** — rejected; CSS variables + `className` merge is the shadcn-native path already in the codebase, zero new deps.
- **Fixed endpoint constants (`/responses` baked in)** — rejected; a host with a renamed route would have to patch source. Endpoint naming must be config.
- **A theme-config JS API** — deferred; CSS-variable override covers the need without shipping an API surface to maintain.

## Consequences

**Better:**
- A consumer re-skins by overriding CSS variables and points at their backend via env — no fork.
- Class override + `data-slot` hooks let hosts restyle any element without touching this repo.
- Endpoint renaming is absorbed by config/adapters, keeping the UI vendor-neutral.

**Worse:**
- Theme tokens and `data-slot` names become a public contract — renaming one is a breaking change.
- Every new component carries the obligation to forward `className` and expose slots.

**Must now be true (invariants):**
- Visual tokens stay CSS variables in `globals.css`; no component hardcodes a color/radius/font that a token already covers.
- Every component forwards `className` through a trailing `cn(...)` so consumer classes override defaults.
- No transport adapter hardcodes an endpoint path, event name, or request/response field name that a host might rename — those live in adapter config.
- All customization is browser/build-time only; no secrets, no server config (see [`repo-boundaries.md`](./repo-boundaries.md)).

## Revisit if

A consumer needs customization that CSS variables + `className` can't express (e.g.
structural layout slots or a runtime theme-switch API), or endpoint config grows
beyond what public env + adapter config can carry.
