# Quickstart & Validation: Chat MVP

How to run and prove the feature works end-to-end against the mock transport. No
Databricks access required. All commands run from `frontend/`.

## Prerequisites

- Node 22.x (Databricks Apps target), `pnpm` (`corepack enable`).
- Install: `pnpm install --frozen-lockfile`.

## Run the demo (zero config)

```bash
pnpm dev            # http://localhost:3000 — defaults to NEXT_PUBLIC_TRANSPORT_MODE=mock
```

Expected: the chat screen loads (no agent selector — no agents URL). Type a message,
send → your message appears instantly; an assistant reply streams in from
`public/recordings/default.txt`, showing a tool activity item on the timeline and
settling into rendered markdown/code. Reload the page → the conversation is restored
from `localStorage`. (SC-001, SC-002, SC-008)

## Validate the acceptance scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| US1 send→stream→render | Send "hello" | User bubble immediate; assistant streams; markdown + code block rendered, no raw markup. |
| US1 empty input | Send with blank/whitespace | Nothing sent, no empty bubble. |
| US2 cancel | Send, click cancel mid-stream | Streaming stops ~1s; partial reply kept, marked stopped; composer re-enabled. |
| US1 queue | Send a 2nd message while streaming | 2nd message queued, auto-sends after the 1st completes; no interleaving. |
| US3 tool timeline | Use the default recording | Tool activity shown distinct from prose. |
| US3 error | Point loader at the error fixture | Inline error on the reply; app still usable for next message. |
| US3 feedback | 👍/👎 + optional comment, submit | Sink called (mock when no feedback URL); state reflected; toggling replaces choice; failure non-blocking. |
| US4 history (local) | Chat, then reload | Conversation restored from localStorage. |
| US4 history (remote) | Set `NEXT_PUBLIC_HISTORY_API_URL`; mock the endpoint | Prior conversation loads on start; turns saved. Simulate a 500 → falls back to localStorage, no crash. |
| US5 agents | Set `NEXT_PUBLIC_AGENTS_API_URL` returning a list | Selector shows agents; selecting one puts `agentId` on requests. Unset/failed/empty → selector hidden, chat still works. |

## Repoint config without code changes (SC-004, SC-006, SC-010)

```bash
# Streaming networked mode is stubbed this feature — expect a clear "not implemented"
# message, proving mode selection is wired purely through public config.
NEXT_PUBLIC_TRANSPORT_MODE=chat-completions NEXT_PUBLIC_CHAT_ENDPOINT_URL=https://example/api pnpm dev

# Each capability is an independent URL; any subset works. History/feedback/agents
# remote providers are REAL (point them at a host endpoint matching contracts/providers.md).
NEXT_PUBLIC_HISTORY_API_URL=https://host/history \
NEXT_PUBLIC_FEEDBACK_API_URL=https://host/feedback \
NEXT_PUBLIC_AGENTS_API_URL=https://host/agents \
  pnpm dev
```

Also restyle: override a theme token in `globals.css` or pass a `className` to a chat
component — appearance changes with no component-source edit.

## Tests

```bash
pnpm test          # vitest run — unit (sse/reducer/queue/mock) + component (useChat, chat UI)
pnpm lint          # eslint
pnpm build         # next build (static export) + verify:databricks-output (no file > 9.5MB, no secrets)
```

Expected: unit tests cover the SSE parser, reducer transitions, and send-queue purely
(fake timers, fixtures); component tests drive `useChat` against an in-memory transport
to exercise US1–US3; the build passes the static-export and size/secret guards (SC-007).

## Fixtures & recordings

- `public/recordings/default.txt` — committed, drives the demo.
- `src/lib/**/__tests__/fixtures/*.txt` — committed test recordings (happy, tool,
  error, empty).
- `sse-recordings/` — gitignored; drop your own captures here for local dev; never
  required for build/CI.

## Definition of Done (feature-level)

All acceptance scenarios pass against the mock; `pnpm test`, `pnpm lint`, and
`pnpm build` are green; Constitution Check still passes (UI-only, no secrets,
static-export, transport-adapter, customization contract).
