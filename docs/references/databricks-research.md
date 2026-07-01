# Databricks & Stack Research (background reference)

> **Tier:** Cold reference — load on demand. This is the evidence base behind the
> decisions in [`docs/design-docs/`](../design-docs/). The binding choices and
> invariants live there; this file records the findings that led to them.

Research date: 2026-07-01

Scope update: the current implementation target is UI-only. Backend/BFF notes in this research are retained as deployment context for an external wrapper, not as implementation requirements for this repo.

## Goal

Build a maintainable frontend chat app for Databricks agents. The same UI should support:

- Static notebook/proxy deployment: only generated static files can be served.
- Databricks Apps deployment: managed Databricks runtime can run a Node.js server/BFF and connect securely to Databricks resources.

The user preference is to use Next.js because it is familiar. The package choices should follow patterns already used in `specdeck`, `lakemind/frontend`, and `timezlab`.

Chosen repo name: `dbx-agent-chat-ui`.

## Databricks Findings

Databricks Apps is the best supported path for a custom user-facing app. It is designed for data and AI applications, including RAG chat apps and operational interfaces. It supports Python and Node.js apps, including React, Angular, Svelte, Express, Streamlit, Dash, and Gradio.

Source: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/

The Databricks Apps runtime provides:

- Ubuntu 22.04 LTS.
- Python 3.11.
- Node.js 22.16.
- Default compute size: Medium, up to 2 vCPUs and 6 GB memory.
- Runtime env vars such as `DATABRICKS_HOST`, `DATABRICKS_APP_PORT`, `DATABRICKS_CLIENT_ID`, and `DATABRICKS_CLIENT_SECRET`.

Source: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env

Apps must listen on `0.0.0.0` and on the port from `DATABRICKS_APP_PORT`. Databricks recommends lightweight startup, stdout/stderr logging, no privileged operations, no custom TLS handling, and async request patterns for long-running operations.

Source: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices

Deployment behavior:

- If `package.json` exists, Databricks installs Node dependencies, runs `npm run build` or `pnpm run build` if defined, then runs the `app.yaml` command or `npm run start`.
- Databricks supports Python, Node.js, or mixed Python plus Node apps.
- App files cannot exceed 10 MB each.
- Deployment can happen from workspace sync or Git.

Sources:

- https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy
- https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-development

Databricks Apps resources can bind managed access to Model Serving endpoints, SQL warehouses, MLflow experiments, secrets, Unity Catalog tables/volumes/functions, Lakebase databases, Genie Spaces, AI Search indexes, and other apps. For this chat app, the most relevant resources are Model Serving endpoint, MLflow experiment, Lakebase database, secrets, and possibly AI Search index.

Source: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources

Auth model:

- App authorization uses a dedicated service principal. Good when all users share the same app permissions.
- User authorization forwards the current user's access token to the app. Good when Unity Catalog permissions, row filters, column masks, or endpoint auth policies must be respected per user.
- User authorization is public preview and requires scopes such as `serving.serving-endpoints` for some endpoints.

Sources:

- https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth
- https://docs.databricks.com/aws/en/generative-ai/agent-framework/chat-app

Databricks' official agent chat UI example uses Next.js, React, and AI SDK. It demonstrates streaming, tool calls, Databricks auth, persistent history in Lakebase, and feedback logging to MLflow.

Source: https://docs.databricks.com/aws/en/generative-ai/agent-framework/chat-app

For querying agents, Databricks recommends Databricks OpenAI Client for new apps, with REST API as the language-agnostic/OpenAI-compatible option. Relevant REST shapes:

- Apps-hosted `ResponsesAgent`: `POST <app-url>.databricksapps.com/responses`.
- Model Serving Responses endpoint: `POST https://<host>/serving-endpoints/responses`.
- Legacy chat completion endpoint: `POST https://<host>/serving-endpoints/chat/completions`.

Source: https://docs.databricks.com/aws/en/generative-ai/agent-framework/query-agent

## Databricks App Limits And File Handling

### Limits Found In Official Docs

| Area | Limit / behavior | Source | Impact for `dbx-agent-chat-ui` |
| --- | --- | --- | --- |
| Number of Databricks Apps | 100 Databricks apps per workspace. Fixed limit. | [Resource limits](https://docs.databricks.com/aws/en/resources/limits) | One app per environment/workspace is fine. Avoid creating many throwaway apps in shared workspaces. |
| App source file size | Any file in the app directory must be <= 10 MB. Deployment fails if any file exceeds this limit. | [Develop Databricks apps](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-development) | Enforce bundle chunk checks. Avoid large single JS chunks, large fonts, large images, source maps, embedded data, or generated artifacts in the app source. |
| Total app source size | No explicit total app directory size limit was found in the Databricks Apps docs reviewed. | Inference from reviewed Apps docs | Treat the 10 MB per-file limit as the hard Apps-specific limit, and use workspace/Git folder limits as surrounding constraints. Keep total app size small for deploy speed and cold-start safety. |
| Workspace file size | Workspace Files individual file size limit is 500 MB. | [Resource limits](https://docs.databricks.com/aws/en/resources/limits) | This is not the Apps app-directory limit. It matters when syncing/uploading source into Workspace Files, but Apps deployment is still stricter at 10 MB per app file. |
| Workspace folder structure | Workspace folder depth limit is 25. Maximum children in a folder is 10,000. Workspace object name length is 500 characters. | [Resource limits](https://docs.databricks.com/aws/en/resources/limits) | Keep app source paths shallow. Avoid generated folders with many files at one level if they might be synced. |
| Workspace files supported formats | Workspace files can be almost any type. Examples include `.ipynb`, `.py`, `.sql`, `.r`, `.scala`, `.dbquery.ipynb`, `.lvdash.json`, `.dbalert.json`, `.yaml`, `.yml`, `.md`, `.txt`, `.csv`, `.whl`, `.jar`, `.log`. | [What are workspace files?](https://docs.databricks.com/aws/en/files/workspace) | App source can include common web files, config files, and code. Do not rely on Workspace Files examples as permission to ship oversized binaries in the app. |
| Workspace import behavior | UI import supports drag/drop or browse. Only notebooks can be imported from a URL. `.zip` import is automatically unzipped and each included file/notebook is imported. `.whl` files can be imported for libraries. | [Workspace files basic usage](https://docs.databricks.com/aws/en/files/workspace-basics) | For manual uploads, zip can be convenient, but final files still need to respect app deployment limits. |
| Git folder size | Git folder working branch size limit is 1,000 MB. Total number of files including notebooks is 20,000. | [Resource limits](https://docs.databricks.com/aws/en/resources/limits) | Relevant only if an approved internal Git path is used later. Keep `node_modules`, `.next`, test artifacts, and large outputs out of source control. |
| Git folder supported assets | Git folders support File, Notebook, Folder, Query, Dashboard, and Alert asset types. File examples include libraries, binaries, code, or images. Notebook recognition uses `.ipynb` or source notebook markers. | [Supported asset types in Git folders](https://docs.databricks.com/aws/en/repos/supported-artifact-types) | A normal Next/Node repo should be compatible. Avoid name collisions between notebooks and files with the same logical name. |
| Git folder naming rules | File/folder names cannot include `/`; each file or folder name in a path cannot exceed 255 bytes; notebooks cannot share logical names with files/folders in the same folder. | [Supported asset types in Git folders](https://docs.databricks.com/aws/en/repos/supported-artifact-types) | Use conventional simple paths. Avoid generated route/file names that become very long. |
| Recommended storage for data/artifacts | Databricks recommends workspace files for notebooks, queries, and code; Unity Catalog volumes for structured/semi-structured/unstructured data, raw data, logs, large ZIPs, build artifacts, wheels, and JARs. Workspace files are for smaller files under 500 MB; volumes support upload/download up to 5 GB. | [Recommendations for files in volumes and workspace files](https://docs.databricks.com/aws/en/files/files-recommendations) | Keep the app repo source-only. Put data, large images, generated exports, logs, model artifacts, and downloadable bundles in Unity Catalog volumes or external storage, not the app deployment directory. |
| Node dependency install | Databricks uses `pnpm` when `pnpm-lock.yaml` exists, with `pnpm install --frozen-lockfile`. Build-time packages must not be hidden in devDependencies if deployment uses production install behavior. | [Manage dependencies](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/dependencies) | Commit lockfile and keep it synced. Keep required build/server packages available to Databricks deployment. |
| Model Serving request payload | Model Serving payload size limit is 16 MB. | [Resource limits](https://docs.databricks.com/aws/en/resources/limits) | Chat requests, history replay, custom inputs, and attachments forwarded to serving endpoints must be bounded. |
| AI Search query/response | AI Search query text length: 32,764 characters. Hybrid search token limit: 1,024 words or 2-byte characters. Max response size: 10 MB. | [Resource limits](https://docs.databricks.com/aws/en/resources/limits) | If the chat UI later queries AI Search directly or via BFF, validate query length and handle response truncation/empty states. |

### Practical Guardrails For The Next.js Build

Databricks Apps' most relevant hard constraint for this frontend is the **10 MB per app file** limit. For a Next static export, the files most likely to violate it are:

- Large JavaScript chunks in `out/_next/static/chunks`.
- CSS bundles if too much UI/library CSS is pulled in.
- Fonts in `public/` or emitted assets.
- Images, screenshots, PDFs, demos, and sample data.
- Source maps if generated and deployed.
- Accidental artifacts such as `.next/cache`, `node_modules`, coverage reports, videos, or archives.

Recommended checks for `dbx-agent-chat-ui`:

- Add a build verification script that fails if any deployed file is larger than 9.5 MB.
- Run that verification after `next build` so the generated `out/` tree is checked before Databricks deployment.
- Do not deploy source maps to Databricks Apps unless explicitly needed and size-checked.
- Keep images outside the app source unless they are small UI assets.
- Use dynamic imports for heavy optional UI panels.
- Keep `monaco-editor`, JupyterLab packages, charting libraries, and large icon packs out of the MVP unless required.
- Exclude `node_modules/`, `.next/cache`, test output, coverage, local `.env`, screenshots, videos, and archives from `databricks sync`.
- Treat Unity Catalog volumes as the place for large user files, generated exports, logs, or reusable build artifacts.

### Next Output Shape Versus A 3-File Bundle

For Databricks Apps, the safest baseline is to keep the normal Next.js static export output:

- `out/index.html` and route HTML files.
- `out/_next/static/...` hashed JavaScript and CSS chunks.
- Small assets under `out/` when needed.

That shape is compatible with a thin Express BFF that serves static files from `out/`. It is also easier to validate because every emitted file can be checked against the 10 MB per-file Databricks Apps limit.

Do **not** manually post-process the default Databricks Apps build into exactly three one-line files. That would:

- Increase the risk that one JavaScript file crosses the 10 MB hard limit.
- Break Next's generated asset references unless the post-processing is very carefully maintained.
- Reduce browser cache granularity because every small code change invalidates the large combined file.
- Duplicate minification work that Next already performs for production builds.

If the notebook/proxy static target truly cannot serve a folder tree such as `_next/static`, then add a separate `embed` build target later. That target can reuse the chat UI code but produce a deliberately constrained `index.html`, `app.css`, and `app.js` bundle through a dedicated bundler pipeline. It should be treated as a proxy-specific exception, not the default Next/Databricks Apps output.

### Manual-Copy Artifact Options

Because some environments may not allow Git integration and may make CLI sync inconvenient, the repo should also provide manual-copy artifacts. These artifacts should be explicit build outputs, not hand-edited folders.

Recommended artifact tiers:

| Artifact | Target | File count copied by human | Contents | Notes |
| --- | --- | --- | --- | --- |
| `release/dbx-agent-chat-ui-source.zip` | Databricks Apps Workspace Folder deployment | 1 zip | App source, `package.json`, `pnpm-lock.yaml`, `app.yaml`, server code, UI source | Upload/import zip into Workspace so it unzips, then deploy the unzipped folder. Databricks still runs the build. Do not include `node_modules`, `.next`, `out`, `.env`, screenshots, coverage, videos, archives, or large data. |
| `release/dbx-agent-chat-ui-static.zip` | Static host that can unzip/serve folders | 1 zip | Normal Next `out/` directory | Useful when the proxy/static host can serve a directory tree but manual upload is easier as a single archive. |
| `manual/index.html` or `manual/index.html` + `manual/app.css` + `manual/app.js` | Static host that requires minimal file count | 1 to 3 files | Dedicated embedded React build from shared UI code | Use only for notebook/proxy/manual-copy mode. This should not replace the Databricks Apps build. |

For Databricks Apps, the source zip is usually better than zipping `out/` because Databricks Apps expects a runnable app source directory with `package.json`, dependencies, and `app.yaml`. The generated `out/` directory is a build artifact, not the app source contract.

For the 1 to 3 file embedded static artifact:

- Build it from shared chat UI modules through a dedicated `embed` entrypoint.
- Do not mutate or rewrite Next's generated `out/`.
- Keep all files below the 9.5 MB verification threshold.
- Inline CSS/JS into one `index.html` only if the result stays safely below the threshold.
- Fall back to three files (`index.html`, `app.css`, `app.js`) when one HTML file becomes too large or when the target blocks inline scripts/styles.
- Avoid external fonts, large images, source maps, demo data, and heavy optional panels.
- Require endpoint configuration through public runtime config in the HTML or a small generated config block.
- Never include Databricks credentials, PATs, OAuth client secrets, or service-principal secrets in this artifact.

### Deployment Workflow For Many Output Files

The normal Next.js static export can produce many files, but Databricks Apps deployment should not require manually copying those generated files.

For Databricks Apps in a restricted/security-sensitive environment, prefer Workspace Folder deployment with Databricks CLI sync:

- Keep source code on the approved machine or approved internal CI runner.
- Sync the source directory to a Databricks Workspace folder.
- Deploy the app from that Workspace folder.
- Let Databricks install dependencies and run `pnpm run build` during deployment.
- The generated `out/` files are produced inside the Databricks Apps deployment process.

This avoids connecting Databricks Apps to a personal Git account while still avoiding manual copy of hundreds of generated files.

Recommended local/dev workflow:

```bash
databricks sync --watch . /Workspace/Users/<user>/dbx-agent-chat-ui
databricks apps deploy dbx-agent-chat-ui \
  --source-code-path /Workspace/Users/<user>/dbx-agent-chat-ui
```

Recommended CI/release workflow if an approved CI runner can authenticate to Databricks:

```bash
databricks sync --full . /Workspace/Users/<service-user>/dbx-agent-chat-ui
databricks apps deploy dbx-agent-chat-ui \
  --source-code-path /Workspace/Users/<service-user>/dbx-agent-chat-ui
```

Use `.gitignore` or `databricks sync --exclude-from` to avoid syncing `node_modules/`, `.next/`, `out/`, `.env`, coverage, videos, screenshots, archives, and large data files. Databricks docs explicitly recommend excluding common local/generated files when using sync.

Git deployment remains optional only if the organization provides an approved internal repository and credential path. It should not be required for this repo.

For the notebook/proxy static target, choose based on what that hosting path can serve:

- If it can serve a directory tree, upload/sync the full `out/` directory or import a zip that is unzipped on upload.
- If it can only handle a tiny number of static files, create the separate `embed` build target described above.
- If Databricks CLI sync is unavailable and a human must upload files, use the source zip artifact for Databricks Apps or the static/embed artifact for proxy mode.

Sources:

- https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy
- https://docs.databricks.com/aws/en/dev-tools/cli/reference/sync-commands

### Unanswered / Not Found In Official Docs Reviewed

The official Databricks Apps docs reviewed did **not** state:

- A total maximum size for the whole app directory.
- A special allowlist of file extensions for a Databricks Apps app source directory.
- A maximum number of files specifically for a Databricks Apps deployment.

For now, use:

- 10 MB per file as the Apps-specific hard deployment constraint.
- Workspace Files and Git folder limits as surrounding storage/source-control constraints.
- Unity Catalog volumes for anything large or data-like.

## Databricks Docs Inventory

This is the detailed map of Databricks documentation reviewed and how each page affects the repo design.

| Doc | Key findings | Repo impact |
| --- | --- | --- |
| [Databricks Apps overview](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/) | Databricks Apps runs secure data/AI apps on Databricks serverless infrastructure. It explicitly lists RAG chat apps as a common use case and supports Node.js frameworks such as React and Express. | Treat Databricks Apps as the primary production path. Use React/Next for UI and Express for the Databricks Apps BFF. |
| [Develop Databricks apps](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-development) | Databricks Apps uses environment variables and `app.yaml` for runtime settings. App files cannot exceed 10 MB. Local development should happen in an IDE, then code is moved to the workspace. | Keep frontend chunks small, avoid embedding large assets, and record all runtime differences in `app.yaml` or env. |
| [Databricks Apps environment](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env) | Runtime is Ubuntu 22.04, Python 3.11, Node.js 22.16, with default Medium compute. Default env includes `DATABRICKS_HOST`, `DATABRICKS_APP_PORT`, `DATABRICKS_CLIENT_ID`, and `DATABRICKS_CLIENT_SECRET`. Express also receives `PORT`. No Node libraries are preinstalled. | Target Node 22. Put every runtime dependency in `package.json`. The Express server should bind `0.0.0.0` and choose `process.env.PORT ?? process.env.DATABRICKS_APP_PORT`. |
| [Configure app execution with app.yaml](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime) | `app.yaml` supports `command` and `env`. Commands are sequences, not shell strings. Databricks may substitute `DATABRICKS_APP_PORT` in commands, but other shell env assumptions should not be used. | Use explicit command arrays such as `["node", "server/index.mjs"]`. Avoid shell features in `app.yaml`. Use `env.valueFrom` for bound resources. |
| [Manage dependencies](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/dependencies) | Node dependencies are declared through root `package.json`. Databricks supports npm and pnpm; `pnpm-lock.yaml` selects pnpm. Build-time packages must be in `dependencies` if `NODE_ENV=production` skips dev dependencies. `pnpm install --frozen-lockfile` requires lockfile sync. | Commit `pnpm-lock.yaml`. Keep Databricks build-critical packages available during deployment. Avoid relying on unsynced lockfiles. |
| [Deploy a Databricks app](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy) | If root `package.json` exists, Databricks installs Node deps, runs `build` if present, then runs `app.yaml` command or default `npm run start`. Mixed Node/Python apps are supported. Deployment can be workspace folder or Git. | Make the app root self-contained. Keep `build` as `next build` and `start` as the Express BFF. Use Workspace Folder deployment with CLI sync as the default when personal Git connectivity is not allowed. |
| [Add resources](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources) | Resources avoid hardcoded IDs and provide managed credentials/permissions. Relevant resources include Model Serving endpoint, MLflow experiment, Lakebase database, secret, SQL warehouse, Unity Catalog volume/table/function, AI Search index, and app-to-app invocation. | Do not hardcode serving endpoint IDs, warehouse IDs, experiment IDs, or database identifiers in frontend code. Bind them as resources and expose only server-side env. |
| [Configure authorization](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth) | App authorization gives the app a dedicated service principal. User authorization can forward the current user's token through headers such as `x-forwarded-access-token` and is used when per-user permissions matter. OAuth scopes constrain user authorization. | Default to app authorization. Add user authorization only when endpoint auth policy, Supervisor Agent, Unity Catalog row/column policies, or audit requirements need per-user access. |
| [Configure compute resources](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/compute-size) | Medium gives up to 2 vCPUs and 6 GB memory; Large gives up to 4 vCPUs and 12 GB memory. Medium is default and fits most standard apps. | Start with Medium. Keep agent inference and data processing outside the app compute; the BFF should only render/proxy. |
| [Best practices for Apps](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices) | App compute is optimized for UI rendering. Use SQL warehouses, Model Serving, and Lakeflow for heavier work. Bind host/port correctly, log to stdout/stderr, handle SIGTERM within 15 seconds, avoid privileged operations, validate input, use async patterns for long-running operations, and apply least privilege. | Keep Express thin, add graceful shutdown, validate request bodies with `zod`, stream long model calls, log structured events to stdout, and avoid local file logging. |
| [Build and share a chat UI](https://docs.databricks.com/aws/en/generative-ai/agent-framework/chat-app) | Official chat app supports Databricks agents on Apps, Model Serving Chat/Responses endpoints, Knowledge Assistant, Supervisor Agent, and Foundation Model endpoints. Example app uses Next.js, React, and AI SDK. It supports streaming, tool calls, Databricks auth, Lakebase history, MLflow feedback, and user authorization scopes. Known limitations include no multimodal inputs. | Use the official template as a feature benchmark, not as a hard dependency. MVP should support streaming and tool-call display first; Lakebase history, MLflow feedback, and user authorization can be staged. |
| [Query agents](https://docs.databricks.com/aws/en/generative-ai/agent-framework/query-agent) | Databricks recommends Databricks OpenAI Client for new apps and REST API for OpenAI-compatible, language-agnostic integration. Apps-hosted agents use `/responses`; Model Serving can use `/serving-endpoints/responses` or `/serving-endpoints/chat/completions` depending on schema. | Implement transport adapters for Responses API and Chat Completions API. Keep endpoint shape outside UI components. |
| [Resource limits](https://docs.databricks.com/aws/en/resources/limits) | Includes 100 Databricks apps per workspace, Git folder size/file-count limits, Workspace Files 500 MB individual file size, Model Serving 16 MB payload size, and AI Search query/response limits. | Add size checks and request validation. Keep large artifacts out of the app and use Databricks resources for storage/inference. |
| [What are workspace files?](https://docs.databricks.com/aws/en/files/workspace) | Workspace files can be almost any type of file, with examples across notebooks, source files, YAML, Markdown, text/CSV, wheels/JARs, and logs. | App source format is flexible, but app deployment has stricter file-size constraints. |
| [Workspace files basic usage](https://docs.databricks.com/aws/en/files/workspace-basics) | Workspace UI can import files through drag/drop or browse; ZIP imports are unzipped automatically; only notebooks can be imported from URL. | Manual import is possible, but Databricks CLI sync should be the main workflow when Git integration is unavailable. |
| [Supported asset types in Git folders](https://docs.databricks.com/aws/en/repos/supported-artifact-types) | Git folders support files, notebooks, folders, queries, dashboards, and alerts; file naming has collision and byte-length rules. | Keep repo paths conventional and avoid notebook/file name collisions. |
| [Recommendations for files in volumes and workspace files](https://docs.databricks.com/aws/en/files/files-recommendations) | Workspace files are recommended for code/small files; Unity Catalog volumes are recommended for data, large files, logs, build artifacts, wheels, JARs, and large ZIPs. Workspace upload/download up to 500 MB; volumes up to 5 GB. | Put large runtime/user artifacts in volumes, not in the app source or static frontend bundle. |

### Databricks Docs Gaps For This Repo

The Databricks Apps docs cover Databricks Apps well, but the notebook/proxy static deployment path is effectively a generic static hosting constraint from this repo's perspective. For that path, the frontend should assume:

- It may only ship HTML, CSS, JavaScript, and static assets.
- It cannot rely on a Node server, Next route handlers, cookies, or server-only env.
- It must call an already-exported/proxied backend endpoint.
- Auth and secrets must be handled by that backend/proxy layer, not the browser bundle.

### Databricks Docs-Derived Implementation Checklist

- Add `app.yaml` at the deployed app root with an explicit `command`.
- Build with `next build` and serve `out/` from Express in Databricks Apps mode.
- Include `pnpm-lock.yaml`; keep lockfile in sync with `package.json`.
- Keep per-file artifacts below 10 MB.
- Add a CI/build check for the 10 MB Databricks Apps per-file limit and run it after `next build`.
- Keep Next's normal chunked static output for Databricks Apps; do not collapse it into a few monolithic files.
- Prefer Workspace Folder deployment with Databricks CLI sync when personal Git connectivity is not allowed.
- Keep generated folders excluded from sync so Databricks builds `out/` during deployment.
- Keep app count low; each workspace has a 100-app fixed quota.
- Read `DATABRICKS_HOST`, `DATABRICKS_APP_PORT`, `DATABRICKS_CLIENT_ID`, and `DATABRICKS_CLIENT_SECRET` only server-side.
- Bind Model Serving endpoint, MLflow experiment, Lakebase database, and secrets as Databricks Apps resources where possible.
- Default to app authorization; add user authorization scopes only when required.
- Add graceful shutdown for SIGTERM and use stdout/stderr logging.
- Use streaming or async status polling for long-running agent calls.
- Validate every incoming BFF request body before forwarding to Databricks.
- Bound chat request payloads below Model Serving's 16 MB payload limit.

## Next.js Static Export Findings

Next.js can generate static HTML/CSS/JS assets using:

```ts
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};
```

After `next build`, output is written to `out/`. That output can be hosted by any static web server.

Source: https://nextjs.org/docs/app/guides/static-exports

Static export constraints matter for this project:

- No dynamic route params unless generated statically.
- No request-dependent route handlers.
- No cookies.
- No rewrites, redirects, custom headers, proxy, ISR, server actions, draft mode, or default image optimization.
- Browser-only APIs must be accessed from client components and inside effects or event handlers.

Because of these constraints, the shared UI should not depend on Next route handlers or server actions. For Databricks Apps, a separate Node BFF can serve the exported UI and proxy `/api/*` to Databricks. That preserves one static frontend build for both deployment modes.

## Vite Finding

Vite is excellent for static React bundles, and Lakemind already uses a Vite-powered `viewer` build. However, Vite is not a drop-in build engine for a Next.js app. Next.js builds with `next build`, currently using Turbopack by default or Webpack if opted in.

Source: https://nextjs.org/docs/app/api-reference/turbopack

Decision implication: use Next.js static export instead of trying to build a Next app through Vite.

## Local Repo Findings

### timezlab

Evidence:

- `timezlab/package.json`
- `timezlab/next.config.ts`
- `timezlab/components.json`
- `timezlab/tsconfig.json`

Observed stack:

- `pnpm@10.28.2`.
- Next `16.2.9`, React `19.2.4`.
- App Router, TypeScript strict mode, `@/*` path alias to `src/*`.
- `output: "export"` already in use.
- `reactCompiler: true`.
- `images.unoptimized: true`.
- `trailingSlash: true`.
- Tailwind CSS v4 via `@tailwindcss/postcss`.
- `shadcn` v4 style `radix-nova`, base color `neutral`, CSS variables, lucide icons.
- `next-intl` for static-compatible i18n.

Relevance:

- Confirms Next static export is already an accepted local pattern.
- Confirms current preferred Next/React versions.
- Confirms Tailwind v4 and shadcn/Radix conventions.

### specdeck

Evidence:

- `specdeck/web/package.json`
- `specdeck/web/next.config.ts`
- `specdeck/web/src/lib/api/base.ts`
- `specdeck/web/src/hooks/use-provisioning-events.ts`
- `specdeck/web/src/app/providers.tsx`
- `specdeck/web/src/env.ts`

Observed stack:

- `pnpm@10.28.2`.
- Next `16.2.9`, React `19.2.4`.
- `reactCompiler: true`.
- `@tanstack/react-query` for client data state.
- `axios` API client base class.
- `@microsoft/fetch-event-source` for SSE streams, including POST streams.
- `@t3-oss/env-nextjs` plus `zod` for env validation.
- `streamdown` for streamed markdown/prose rendering.
- Vitest and Testing Library for focused tests.
- shadcn `new-york`, base color `neutral`, lucide icons.

Relevance:

- Strongly supports using a typed API adapter layer instead of scattering `fetch` calls through components.
- Strongly supports `fetch-event-source` for Databricks streaming because it handles POST SSE and retry behavior better than native `EventSource`.
- Supports `streamdown` for assistant markdown output.

### lakemind/frontend

Evidence:

- `/home/liamlee/projects/lakemind/frontend/package.json`
- `/home/liamlee/projects/lakemind/frontend/next.config.ts`
- `/home/liamlee/projects/lakemind/frontend/hooks/chat/use-chat.ts`
- `/home/liamlee/projects/lakemind/frontend/lib/api/agent-stream.ts`
- `/home/liamlee/projects/lakemind/frontend/app/api/chat/[conversationId]/stream/route.ts`
- `/home/liamlee/projects/lakemind/frontend/components/lakemind/chat/chat-message.tsx`
- `/home/liamlee/projects/lakemind/frontend/env.ts`

Observed stack:

- Next `16.1.7`, React `19.2.3`.
- Tailwind CSS v4.
- `@tanstack/react-query` for API cache and mutation invalidation.
- `axios` and service/client classes for JSON APIs.
- `@microsoft/fetch-event-source` for stream transport.
- `streamdown`, `@streamdown/code`, and `@streamdown/mermaid` for rich chat rendering.
- `zod` entities for typed schemas.
- `@t3-oss/env-nextjs` for fail-fast env validation.
- Next route handlers used as auth-aware proxy routes.
- NextAuth/Keycloak for app-specific auth.
- Sentry and PostHog for production observability.
- `vite` and `vite-plugin-singlefile` for a separate static viewer target.

Relevance:

- The chat implementation already proves the pattern: local optimistic message state, `AbortController`, SSE parser, reducer-driven stream events, persisted conversations, feedback hooks, and markdown/tool/timeline rendering.
- The route handler proxy is useful for full Next server mode, but it cannot be part of the static export path. For the Databricks dual-target repo, keep that proxy behavior in a separate BFF rather than depending on Next route handlers.

## Synthesized Constraints

The shared UI must be static-compatible:

- No hard dependency on cookies, server actions, dynamic route handlers, or server-only env.
- Any public env must be prefixed `NEXT_PUBLIC_`.
- No secrets or Databricks OAuth/PAT values in browser bundles.
- Browser calls should target same-origin proxy paths where possible.

The Databricks Apps deployment should own secure work:

- Resolve Databricks host and app port from runtime env.
- Use app service principal credentials for default app authorization.
- Forward user tokens only when user authorization is configured and required.
- Proxy streaming Databricks agent responses as SSE.
- Keep telemetry and audit logging server-side.

The package stack should follow the local pattern:

- pnpm.
- Next 16, React 19, TypeScript strict.
- Tailwind v4, shadcn/Radix, lucide.
- TanStack Query, axios, zod, t3 env.
- fetch-event-source for streaming.
- streamdown for markdown chat output.
