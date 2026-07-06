# ADR: Zustand session store + backend-only paginated history (no localStorage)

**Status**: Accepted · **Date**: 2026-07-03 · **Feature**: `003-history-store-refactor`

## Context

The first cut kept conversation **history** in `localStorage` (with an in-memory
degrade) as a fallback whenever `NEXT_PUBLIC_HISTORY_API_URL` was unset or a read failed.
In practice this was noisy ("phiền"): a client-side cache that could drift from the
backend, resurrect deleted conversations, and blur the line about who owns the data.
Client-local runtime variables (resolved config, active conversation id, selected agent)
were also scattered across hook state with no single source of truth.

Separately, the capability layer had grown a `client` / `remote` / `mock` / `sink` /
`provider` split per capability, and streaming code lived under `lib/stream/` even though
it belongs to the chat domain. Responses were parsed with `as { conversation?: unknown }`
casts rather than a schema.

## Decision

1. **Backend is the only store of record for history.** No `localStorage`, no in-memory
   cache, no `save` from the UI — a configured backend records turns as they stream. When
   `historyUrl` is unset or a read fails, history is simply **empty** (no fallback).
2. **History is read-only and paginated.** `GET {historyUrl}?page&per_page` returns
   `{ items, page, per_page, total }` (snake_case, newest-first). The sidebar fetches
   **one page at a time** (increment `page`, never grow `per_page`) via TanStack
   `useInfiniteQuery` + `react-infinite-scroll-component`. Detail is `GET {historyUrl}/{id}`
   → the `Conversation` object directly (or `404`). `load(id)` **requires** an id.
3. **A small Zustand session store** (`src/store/session-store.ts`) holds the client-local
   variables: `config` (env-derived, not persisted), `conversationId`, and
   `selectedAgentId`. The two **pointers** (`conversationId`, `selectedAgentId`) ARE
   persisted to `localStorage` (zustand `persist`) — this is a tiny pointer, not history
   data. On startup we re-open the pointed-at conversation by fetching it from the backend;
   if nothing was opened before (`conversationId === null`) the screen is empty (we do NOT
   auto-open "the most recent"). Because the app is statically prerendered, `persist` runs
   with **`skipHydration: true`**: `Providers` calls `persist.rehydrate()` in a mount effect,
   so the first client render matches the prerendered HTML (no hydration mismatch), then a
   `_hasHydrated` flag flips true. The startup re-open effect **waits on `_hasHydrated`** so
   it reads the restored pointer, not the default `null`.
4. **Capabilities are an axios `ApiService` class hierarchy** under `lib/api/`
   (`base.ts` + `HistoryApiService` / `AgentsApiService` / `FeedbackApiService` /
   `IdentityApiService`). Each subclass **declares its own endpoint** from `config`
   (`super(config.historyUrl)`, …); URL unset ⇒ the method returns empty without a request.
   The whole response body is parsed with a zod **entity** schema (declared in
   `src/entities/`) — no `as { … }` casts, no client-side transform: the declared schema IS
   the response contract.
5. **Structure follows a standard Next.js layout.** `lib/stream/*` folded into `lib/chat/*`
   (dead `sse.ts` deleted, `sse-client` merged into `transport.ts`); the store moved to a
   top-level `src/store/`. The long `useChat` hook was split — the Replay subsystem lives in
   `hooks/chat/use-replay.ts`.

## Alternatives considered

- **Keep the localStorage history cache.** Rejected: drift, ghost conversations, unclear
  ownership — the exact pain that motivated this change.
- **Grow `per_page` per fetch (lakemind's approach).** Rejected in favor of page-by-page
  `page` increments — simpler mental model and smaller payloads per fetch.
- **Function-based capability adapters (the old `resolve*` + `createRemote*`).** Rejected in
  favor of a shared axios base class the way the reference project organizes it — less
  duplication (one error-normalization path), each subclass owns its URL.
- **Persist nothing.** Rejected: reopening the last conversation across a reload is worth a
  single persisted id pointer (still not history data).

## Consequences

**Better**
- One source of truth (the backend) for history; no cache to reconcile.
- Session variables have a single shared, testable store.
- Cast-free parsing; one HTTP/error path shared by every capability.
- Cleaner tree (chat code under `lib/chat`, store at top level, shorter `useChat`).

**Worse / trade-offs**
- No offline / no-backend history at all — an unconfigured deployment shows an empty
  sidebar (by design).
- Under `output: export`, the paginated dev mock renders only page 1 statically (query
  params aren't enumerable); `next dev` serves every page.

**Must now be true**
- No `save` and no history `localStorage` anywhere; only the session-pointer store persists.
- Every capability goes through an `ApiService` subclass; response shapes are entities.
- `load(id)` is never called without an id.
