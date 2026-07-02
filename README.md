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

## Quickstart

### 1. Clone & Install

```bash
git clone https://github.com/timezlab/dbx-agent-chat-ui.git
cd dbx-agent-chat-ui/frontend
pnpm install
```

### 2. Environment Setup

Create a `.env` file in the `frontend/` directory. For local development with the included mock API, configure the endpoint as follows:

```env
# Point to the local mock-api script
NEXT_PUBLIC_CHAT_ENDPOINT_URL=http://localhost:3000/api/chat
```

> **Note**: See `frontend/src/env.ts` for a full list of optional configurations, including history (`NEXT_PUBLIC_HISTORY_API_URL`), feedback, and agent selector endpoints.

### 3. Run Locally

The local development environment includes an integrated Mock API route. You only need one terminal:

```bash
cd frontend
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build

To create a static production build (which does not require a Node.js server runtime), run the appropriate build script:

```bash
cd frontend
pnpm build:manual  # For manual ZIP deployment
# OR
pnpm build:embed   # For Databricks HTML embed
```

The compiled output will be packaged in the repository root as `manual.zip` or `embed.html` depending on your build target, ready to be served statically or embedded in Databricks.
