# Deployment Workflow, Repo Layout, and Databricks Limits

**Status:** accepted (repo layout: accepted for future scaffold)
**Date:** 2026-07-01
**Covers:** D-010 (file/size guardrails), D-011 (repo layout), D-012 (deployment workflow)

## Context

Databricks imposes hard per-file and workspace limits, and deployment must not
require personal Git connectivity. The build and repo shape are designed to produce
a static artifact that fits those limits and can be synced or hand-copied. See
[`../references/databricks-research.md`](../references/databricks-research.md)
(Databricks App Limits And File Handling) for the source figures.

## Decision

### Databricks Apps file and size guardrails (D-010)

Hard guardrails:

- Every file deployed in the Databricks Apps app directory must be **≤ 10 MB**.
- The repo must include a build/deploy check that **fails before deployment if any file in the deployable output exceeds 9.5 MB**.
- The check must run after `next build` and inspect the generated `out/` tree.
- Do not deploy source maps by default.
- Do not deploy `node_modules`, `.next/cache`, local `.env`, coverage, screenshots, videos, archives, or generated datasets.
- Keep large runtime/user artifacts in Unity Catalog volumes or external storage.

Bundle shape:

- Use Next.js' normal static-export output as the Databricks Apps baseline.
- Serve or copy `out/` through the external host/wrapper.
- Do not manually copy individual generated files into Databricks.
- Do not post-process the build into exactly three one-line files.
- Avoid monolithic JavaScript bundles (one large file is likelier to hit the 10 MB limit).
- If a proxy target later requires exactly `index.html`, `app.css`, `app.js`, create a separate `embed` build target from shared UI code instead of mutating the main Next output.
- Provide manual-copy artifacts as explicit scripts: source zip for Databricks Apps, static zip for folder-capable proxy hosts, and optional 1–3 file embed output for constrained hosts.

Known surrounding limits (from official docs reviewed): Workspace Files individual
file 500 MB; Git folder working branch 1,000 MB; Git folder total files 20,000;
workspace folder depth 25; max children per folder 10,000; app quota 100 per
workspace; Model Serving payload 16 MB. No total-directory-size limit was documented
— until Databricks documents one, treat the per-file limit as the hard constraint.

### Proposed repository layout (D-011)

```txt
dbx-agent-chat-ui/
  app/            layout.tsx, page.tsx, globals.css
  components/     chat/, layout/, ui/
  hooks/          chat/
  lib/            api/, chat/, databricks/, stream/, utils.ts
  embed/          index.html, main.tsx
  scripts/        verify-databricks-output.mjs, verify-manual-output.mjs, pack-static-output.mjs
  deploy/         databricks/README.md
  public/
  next.config.ts, vite.embed.config.ts, package.json, components.json, tsconfig.json
```

> **Note:** the live app is under [`frontend/`](../../frontend/); see
> [`ARCHITECTURE.md`](../../ARCHITECTURE.md) for the actual vs. target module map.

Build scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build:manual": "node scripts/gen-replay-recording.mjs && next build && rm -rf out-manual && mv out out-manual && node scripts/verify-manual-output.mjs && cd out-manual && python3 -m zipfile -c ../../manual.zip * && cd .. && rm -rf out-manual",
    "build:embed": "node scripts/gen-replay-recording.mjs && vite build --config vite.embed.config.ts && node scripts/verify-embed-output.mjs && cp out-embed/index.html ../embed.html && rm -rf out-embed",
    "lint": "eslint",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest"
  }
}
```

### Deployment workflow (D-012)

Static-artifact-first, no personal Git connectivity required:

- Default: Workspace Folder deployment with Databricks CLI sync.
- Sync source, `package.json`, and `pnpm-lock.yaml` to the approved Workspace folder when the environment can run the build.
- Use `pnpm pack:static` when a human or external wrapper needs a ready-to-serve static artifact.
- Use Git deployment only if the org later provides an approved internal repo and credential path.

Recommended local/dev and release/CI workflow:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm pack:static
```

Sync exclusions: `node_modules/`, `.next/`, `manual.zip`, `embed.html`, `.env`, coverage/test artifacts,
screenshots/videos, archives, large data files.

Manual-copy artifacts:

| Command | Output | Use case |
| --- | --- | --- |
| `pnpm build:manual` | `manual.zip` | One-file upload when a proxy/static host can unzip and serve the full Next `out/` tree. |
| `pnpm build:embed` | `embed.html` | Minimal-file artifact for constrained notebook/proxy hosting. |

The embed output must reuse shared chat UI modules but avoid Next-specific runtime
assumptions. It is a constrained fallback, not the main static-export path.

## Alternatives considered

- **Post-process into exactly three one-line files** — rejected as the default; monolithic bundles risk the 10 MB per-file limit. Kept only as an explicit `embed` fallback for hosts that demand it.
- **Git-based deployment as default** — rejected; must not require personal Git connectivity. Allowed only with an approved internal repo/credential path.
- **Manually copying individual generated files into Databricks** — rejected; error-prone and bypasses the size check.

## Consequences

**Better:**
- One static artifact fits every host from full-directory proxies down to 3-file embed targets.
- The 9.5 MB pre-deploy check catches oversized files before they reach Databricks.

**Worse:**
- Maintaining an `embed` build alongside the Next output is extra surface.
- No documented total-directory limit means we conservatively keep the whole app small.

**Must now be true (invariants):**
- A post-`next build` check fails deployment if any file in `out/` exceeds 9.5 MB.
- Deployment artifacts exclude secrets, `.env`, `node_modules`, `.next`, coverage, screenshots, videos, archives, and large data files.
- The `embed` target reuses shared UI modules and must not assume Next runtime behavior.

## Revisit if

Databricks publishes a total-app-directory size limit, or a deployment host forces a
build shape the current script set can't produce.
