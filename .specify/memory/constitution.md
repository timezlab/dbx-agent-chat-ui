<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Bump rationale: Initial ratification of the project constitution (first concrete version).
- Modified principles: none (initial adoption)
- Added principles:
    I. UI-Only, No Backend (NON-NEGOTIABLE)
    II. No Secrets in the Browser Bundle (NON-NEGOTIABLE)
    III. Static-Export Safe by Default
    IV. Backends Only Through Transport Adapters
    V. Customization Is a Contract
    VI. Test-First (NON-NEGOTIABLE)
    VII. Spec-Driven & Docs-as-Code
- Added sections: Technology & Deployment Constraints; Development Workflow; Governance
- Removed sections: none
- Templates requiring updates:
    ✅ .specify/templates/plan-template.md (generic Constitution Check gate — no edit needed)
    ✅ .specify/templates/spec-template.md (no constitution coupling — no edit needed)
    ✅ .specify/templates/tasks-template.md (no constitution coupling — no edit needed)
    ✅ AGENTS.md / ARCHITECTURE.md / docs/design-docs/* (already consistent with these principles)
- Follow-up TODOs: none
-->

# dbx-agent-chat-ui Constitution

A reusable, UI-only frontend chat app for Databricks agents. These principles are
binding on every change. Where a principle says MUST, a violation blocks merge.

## Core Principles

### I. UI-Only, No Backend (NON-NEGOTIABLE)

This repository owns the frontend UI only. It MUST build to static assets and MUST
NOT contain a Node.js backend, BFF, API route implementation, server runtime, or
Databricks credential/auth handling. The UI MAY call a configured browser-safe
endpoint, but that endpoint is always provided by an external proxy, Databricks
App, gateway, or backend owned outside this repo.

Rationale: the repo is a reusable chat UI, not a runtime; keeping it UI-only is what
lets one build serve notebook proxies, Databricks Apps, and embeds alike.
See `docs/design-docs/repo-boundaries.md`.

### II. No Secrets in the Browser Bundle (NON-NEGOTIABLE)

Browser bundles MUST NEVER contain Databricks secrets, OAuth client secrets, PATs,
or service-principal credentials. Only `NEXT_PUBLIC_*` values are allowed in client
code, and only for non-secret endpoint selection and UI config. Any change touching
env, config, or network boundaries MUST be verified against this rule before merge.

Rationale: a static bundle is world-readable; a secret placed here is a leak by
construction. Auth belongs to the deployment wrapper (Principle I).

### III. Static-Export Safe by Default

The shared UI MUST build with `output: "export"` and MUST NOT depend on Next.js
route handlers, server actions, cookies, rewrites, redirects, or request-time
headers. All chat data fetching stays in client-side adapters. A build that cannot
static-export is a broken build.

Rationale: static export is the shared contract across every deployment target
(`docs/design-docs/repo-boundaries.md`, `deployment-and-limits.md`).

### IV. Backends Only Through Transport Adapters

All chat backends MUST be reached through a single `ChatTransport` adapter
interface. Components MUST NOT fetch an endpoint, parse a stream, or know a vendor
path directly. Streaming MUST use `@microsoft/fetch-event-source`; final assistant
message state MUST be immutable with explicit cache invalidation. A new backend
shape is added by adding an adapter, never by editing UI components.

Rationale: decoupling the UI from any specific Databricks endpoint keeps it
vendor-neutral and testable via `mockTransport` (`docs/design-docs/chat-transport.md`).

### V. Customization Is a Contract

Because the UI is reusable, consumers MUST be able to re-skin it and repoint it
without forking. Therefore: visual tokens MUST stay CSS variables in
`globals.css` (no hardcoded color/radius/font a token already covers); every
component MUST forward `className` through a trailing `cn(...)` so consumer classes
win; and endpoint URL, transport mode, and endpoint path/naming MUST be
configuration, never hardcoded constants. Theme token names and `data-slot` hooks
are a public contract — renaming one is a breaking change.

Rationale: these are protected capabilities, not incidental shadcn defaults
(`docs/design-docs/customization-and-theming.md`).

### VI. Test-First (NON-NEGOTIABLE)

For non-trivial or user-visible behavior, a failing test MUST exist and be seen to
fail for the expected reason before production code is written (`vitest` +
Testing Library). Skipping TDD is allowed only for mechanical changes or a missing
harness, and MUST be stated explicitly in the change. Bug fixes MUST start with a
reproducing test.

Rationale: adapters, stream reducers, and business rules are exactly where silent
regressions hide; the repo's `.claude/rules/tdd.md` makes this binding.

### VII. Spec-Driven & Docs-as-Code

The repository is the system of record. Any feature, API change, or refactor with
≥3 tasks MUST have `spec.md` + `plan.md` + `tasks.md` under
`.specify/specs/NNN-<name>/` approved before source changes. Architectural
decisions worth disagreeing about MUST be captured as an ADR in
`docs/design-docs/`. After a refactor, stale docs MUST be reconciled with the code.

Rationale: if a decision lives only in chat, it does not exist for the agent
(`.claude/rules/spec-driven.md`, `docs-as-code.md`).

## Technology & Deployment Constraints

- Stack baseline: Next.js 16 (App Router), React 19, TypeScript, `pnpm` (commit
  `pnpm-lock.yaml`), Tailwind v4, shadcn/Radix (`new-york` + neutral + lucide),
  TanStack Query, `zod` + `@t3-oss/env-nextjs`, `streamdown`. Node target compatible
  with Databricks Apps Node.js 22.16. Deviations require a decision update
  (`docs/design-docs/stack-and-conventions.md`).
- Databricks deployment: every deployed file MUST be ≤ 10 MB; a post-`next build`
  check MUST fail deployment if any file in `out/` exceeds 9.5 MB. Deployment
  artifacts MUST exclude secrets, `.env`, `node_modules`, `.next`, coverage,
  screenshots, videos, archives, and large data files
  (`docs/design-docs/deployment-and-limits.md`).
- New dependencies from the "avoid" list (`express`, `next-auth`, `sonner`, heavy
  editor/data packages, AI SDK as a hard dep) require an ADR before adoption.

## Development Workflow

- Plan before coding for multi-step/multi-file/novel work; do not write
  implementation code until the plan is approved (`planning-first`).
- Verify before claiming done: run repo-appropriate lint/typecheck/test; a failing
  gate blocks completion (`quality-gates`). The pre-commit hook (conflict markers,
  secret scan, lint/typecheck/test) MUST pass — never `--no-verify`, never `--amend`
  a failed commit.
- Security review is mandatory before merging changes touching auth, secrets,
  env/config, or network boundaries (`security-review`).
- Commits follow Conventional Commits; one logical change per commit; branch and PR
  sizing per `branch-strategy`; never force-push `main`.

## Governance

This constitution supersedes ad-hoc practice. When a change conflicts with a
principle, the principle wins unless the constitution is amended first.

- **Amendments:** proposed via PR that edits this file, states the rationale, and
  bumps the version. A principle marked NON-NEGOTIABLE may only be weakened or
  removed by an explicit MAJOR amendment.
- **Versioning (semver):** MAJOR = backward-incompatible governance/principle
  removal or redefinition; MINOR = new principle/section or materially expanded
  guidance; PATCH = clarifications and non-semantic refinements.
- **Compliance review:** every PR and review MUST verify compliance with these
  principles; the plan-template Constitution Check gate is the enforcement point.
  Unavoidable complexity that bends a principle MUST be justified in the plan's
  Complexity Tracking section, or the change is rejected.

**Version**: 1.0.0 | **Ratified**: 2026-07-01 | **Last Amended**: 2026-07-01
