# Feature Specification: State store, read-only paginated history & repo-structure refactor

**Feature Branch**: `003-history-store-refactor`

**Created**: 2026-07-03

**Status**: Draft (awaiting approval)

**Input**: User description (paraphrased, Vietnamese original): rework history + feedback;
remove the annoying localStorage history entirely; install Zustand to hold client-local
variables (config, conversationId, …); on an API error show **empty** state instead of
falling back to local (as history used to); merge the history module and drop the separate
`provider.ts`; there is no `save` anymore; study the **lakemind** project for the standard
history configuration and response envelope; avoid casts like
`(await getJson(...)) as { conversation?: unknown }`; history must be **paginated**
(`page` / `per_page` / `total`) for infinite scroll, fetched **page-by-page** (increment
`page`, not grow `per_page`) with **TanStack `useInfiniteQuery`**; refactor the repo into a
**standard Next.js structure** (hooks / components / lib / utils / store) — e.g.
`lib/stream/sse-client.ts` belongs with the chat domain — and clean the code along the way.

## Clarifications

### Session 2026-07-03

- Q: Zustand scope? → **Session state** — `config`, `conversationId`, `selectedAgentId`
  (+ leave the streaming reducer & replay playback inside `useChat`; too coupled to move).
- Q: History when backend unset / API errors? → **Completely empty** — no sidebar list, no
  persistence, no reload restore. The browser stores nothing.
- Q: Startup behavior? → **Auto-open the most recent** conversation (keep today's behavior):
  fetch page 1, hydrate `items[0]`'s detail into a still-pristine session.
- Q: How does a just-finished turn appear in the sidebar? → **Optimistic prepend + invalidate**
  page 1 (lakemind pattern): show the current conversation immediately, then let the backend
  row (with its server-assigned title) replace it on refetch.
- Q: List envelope field names? → `page` / `per_page` / `total`, `per_page` default **20**.
- Q: How aggressive a structure reorg? → **Standard Next.js buckets** (`hooks`, `components`,
  `lib`, `utils`, `store`) — no feature-folders. Consolidate chat streaming plumbing into the
  chat domain; move the store to a top-level `store/`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse history from the backend, paginated (Priority: P1)

A user with a configured history backend opens the app, sees their most recent conversations
in the sidebar, scrolls to load older ones a page at a time, and clicks any row to reopen that
full conversation. With no backend configured (or on an API error) the sidebar is simply empty
— nothing is read from or written to the browser.

**Why this priority**: History is the headline capability being reworked; read-only paginated
browse is the core deliverable and the thing the backend contract must lock down.

**Independent Test**: Point `NEXT_PUBLIC_HISTORY_API_URL` at the dev mock; confirm the sidebar
loads page 1, "load more" fetches page 2, clicking a row loads its messages, and unsetting the
URL yields an empty sidebar with no `localStorage` writes.

**Acceptance Scenarios**:

1. **Given** a history backend and >`per_page` conversations, **When** the app loads, **Then**
   the sidebar shows the newest `per_page` rows (newest-first) and the most recent conversation
   is auto-opened in a pristine session.
2. **Given** the sidebar is scrolled to the bottom and more pages exist, **When** the sentinel
   becomes visible, **Then** the next `page` is fetched and its rows appended (previous rows
   stay; no flicker, no duplicate rows).
3. **Given** a past conversation row, **When** the user clicks it, **Then** its full message
   timeline loads via `GET {url}/{id}` and replaces the on-screen conversation (any active
   generation is aborted first).
4. **Given** `historyUrl` is unset **or** the list/detail request errors, **Then** the sidebar
   is empty, no error is thrown to the user, and `localStorage`/`sessionStorage` are never
   touched.
5. **Given** a malformed list or detail payload, **Then** the zod parse fails, the read
   resolves as empty/null, and nothing crashes.

---

### User Story 2 — A single client session store (Zustand) (Priority: P1)

Client-local runtime state — the resolved public `config`, the active `conversationId`, and
the `selectedAgentId` — lives in one Zustand store instead of scattered `useMemo(resolveConfig)`
calls, `useState` in `useAgents`, and `conversation.id` prop-drilling. Consumers read via
selectors; hooks still accept injected overrides so tests never depend on the singleton.

**Why this priority**: The store is the backbone the history + agent wiring reads from; landing
it first makes US1/US3 cleaner.

**Independent Test**: Unit-test the store's actions (`setConfig`, `newConversationId`,
`setConversationId`, `selectAgent`) and confirm `useAgents`/`useChat` read config & selection
from it while still honoring injected option overrides.

**Acceptance Scenarios**:

1. **Given** the app boots with env config, **When** any consumer reads `config`, **Then** it
   sees the env-derived `resolveConfig()` value (re-resolved against `document.baseURI`).
2. **Given** an embedder passes an explicit `config` prop to `<ChatProvider>`, **When** it
   mounts, **Then** the store is seeded with that config and every consumer uses it.
3. **Given** an agent is selected in the selector, **When** a chat request is sent, **Then**
   the request carries the store's `selectedAgentId`.
4. **Given** a test injects `config`/`history`/`transport` into a hook, **Then** the hook uses
   the injected values and does not read or mutate the global store.

---

### User Story 3 — Standard Next.js repository structure (Priority: P2)

The codebase is organized into conventional Next.js buckets so a new contributor finds things
where they expect. Chat streaming plumbing (`lib/stream/*`) is consolidated into the chat
domain (`lib/chat/*`); the Zustand store lives at a top-level `store/`; import paths are
updated repo-wide; stale docs/architecture references are fixed.

**Why this priority**: Structure follows the behavior changes; doing it in the same feature
avoids a second churn pass, but it is not blocking the capability itself.

**Independent Test**: `pnpm typecheck` + `pnpm test` pass after the moves; `grep` finds no
imports of the removed paths (`@/lib/stream/*`, `@/lib/store/*`, `@/lib/history/{provider,remote,summary,local}`).

**Acceptance Scenarios**:

1. **Given** the reorg, **When** grepping the repo, **Then** there are no references to
   `@/lib/stream/*` or `@/lib/history/provider|remote|summary|local` — only `@/lib/chat/*`,
   `@/lib/history`, and `@/store/*`.
2. **Given** `ARCHITECTURE.md`, **Then** its module map reflects the new layout (no "planned"
   entries that are now real, no paths that no longer exist).

---

### User Story 4 — Clean, cast-free data plumbing (Priority: P2)

Response parsing goes through zod schemas that validate the **whole** envelope — no
`as { … unknown }` casts, no hand-reached fields. Dead code from the old localStorage/failover
path is gone.

**Why this priority**: Quality bar the user called out explicitly; small but pervasive.

**Independent Test**: `grep` for ` as { ` casts in `lib/` returns nothing new; the history
module parses list/detail with `.parse`; removed helpers (`stripAttachmentData`, in-memory
degrade, `withLocalFailover`) no longer exist.

**Acceptance Scenarios**:

1. **Given** the remote history reads, **Then** the list body is parsed by an envelope schema
   and the detail body by `ConversationSchema` directly — no intermediate `as` cast.
2. **Given** the old failover/local code, **Then** it is deleted (no `local.ts`, no
   `withLocalFailover`, no `save`).

## Backend contract *(the API this UI expects)*

Modeled on lakemind's conversation API, adapted to this project's entities.

**List — `GET {historyUrl}?page={n}&per_page={m}`** (1-indexed `page`, `per_page` default 20):

```json
{
  "items": [
    { "id": "conv-1", "title": "Query Delta tables", "updatedAt": 1735732800000, "messageCount": 6 }
  ],
  "page": 1,
  "per_page": 20,
  "total": 42
}
```

- `items`: `ConversationSummary[]` (`{ id, title, updatedAt, messageCount }`), newest-first.
- `total`: total conversation count → drives "has next page" (`page * per_page < total`).
- Auth (if any) is the deployment wrapper's job via same-origin cookies (`credentials: "include"`).

**Detail — `GET {historyUrl}/{id}`**: returns the `Conversation` object **directly** (`200`),
or `404` when it does not exist (→ the UI resolves it as `null`). No `{ conversation }` wrapper.
The object is just `{ id, messages }` — see the 2026-07-06 addendum (item 8): the streaming
state machine's fields (`activeId` / `queue` / `status`) are runtime-only and are NOT part of
this contract.

**Writes**: none. The backend records turns as they stream; the UI never PUT/POSTs history.

**Feedback — `POST {feedbackUrl}`** (unchanged): `{ messageId, rating, comment? }` → `200`.

## Requirements *(mandatory)*

### Functional

- **FR-001** History reads are backend-only. No `localStorage`/`sessionStorage` for history.
- **FR-002** List is paginated: `GET ?page&per_page`, parsed as `{ items, page, per_page, total }`.
- **FR-003** The sidebar uses `useInfiniteQuery`, fetching **one page per request** (increment
  `page`); pages accumulate; `getNextPageParam` returns the next page while `page*per_page < total`.
- **FR-004** Detail load: `GET {url}/{id}` → `Conversation` (200) or `null` (404).
- **FR-005** On unset `historyUrl` or any read error/malformed payload: empty list / null detail,
  swallowed (no user-facing throw), nothing persisted.
- **FR-006** Startup auto-opens the most recent conversation into a still-pristine session
  (never clobber a chat the user already started while the load was in flight).
- **FR-007** After a terminal turn: optimistically prepend the current conversation summary to
  the cached page-1 list, then invalidate the list query so the backend row replaces it.
- **FR-008** A Zustand store holds `config`, `conversationId`, `selectedAgentId` + actions;
  `resetSessionStore()` exists for test isolation.
- **FR-009** `useChat`/`useAgents` read config & selection from the store but prefer injected
  options; tests must not depend on the singleton.
- **FR-010** Response parsing uses zod on the whole envelope — no `as { … unknown }` casts.
- **FR-011** History exposes read-only functions `listHistory` + `loadHistory` only — no
  `save`, no port interface, no provider object (see FR-015).
- **FR-012** A `QueryClientProvider` wraps the app (and the docs demo) so React Query works.

### Structure (US3)

- **FR-013** Chat streaming plumbing consolidates into `lib/chat/`:
  - `transport.ts` absorbs `sse-client.ts` (port `ChatTransport` + `createChatTransport` +
    `streamSSE` in one file — the transport IS the SSE client; the `ChatTransport` boundary
    stays, per the constitution, but the near-empty wrapper file is gone).
  - `responses.ts`, `recording.ts`, `replay.ts`, `recordings/` move from `lib/stream/`.
  - No `lib/stream/` folder remains.
- **FR-014** Delete dead code `lib/stream/sse.ts` (`parseRecording`/`extractDataPayloads` — used
  only by its own test; the live path uses `streamSSE`, the replay path uses
  `recording.ts › parseFrames`, which is the same frame-split logic duplicated).
- **FR-015** REST capabilities are organized as an **`ApiService` class hierarchy** under
  `lib/api/` (lakemind pattern, adapted to `fetch`): a base class does the fetch + zod-parse +
  error normalization; each capability is a subclass. The old per-capability `client`/`remote`/
  `mock`/`sink`/`provider` files, port interfaces, `resolve*→null` indirection, and no-op mock
  sink are all deleted.
  - `lib/api/base.ts` — `abstract class ApiService` built on an **axios** instance
    (`axios.create({ baseURL, withCredentials: true, headers: { Accept } })`), constructor
    `(baseURL?: string, client?: AxiosInstance)` (the optional `client` is the test seam — inject
    a mock adapter / instance). Protected `request<T>(schema, config, label)` runs the request
    and `schema.parse`es the body, normalizing `ZodError` + `AxiosError` into a readable `Error`;
    `requestOrNull<T>` maps a 404 to `null`; `requestVoid` for empty-body calls. **No bundled
    secret and NO next-auth/session-refresh logic** — unlike lakemind's base (Principle I/II);
    auth, if any, is the deployment wrapper's same-origin cookies (`withCredentials`).
  - `lib/api/history.ts` — `HistoryApiService`: `list({page,perPage})` → `HistoryPage`,
    `load(id?)` → `Conversation | null`; plus `conversationTitle`/`summarizeConversation` helpers.
  - `lib/api/agents.ts` — `AgentsApiService`: `list()` → `Agent[]`.
  - `lib/api/feedback.ts` — `FeedbackApiService`: `submit(feedback)` → `void`.
  - `lib/api/identity.ts` — `IdentityApiService`: `me()` → `Identity | null`.
  - Each subclass takes its endpoint URL from `config` in its constructor (this app has
    independent per-capability URLs, unlike lakemind's single `/api` base). **URL unset ⇒ the
    method returns empty** (`[]` / `null` / no-op) without fetching; an HTTP/parse error throws
    and the caller swallows it to the same empty state — no fallback anywhere.
  - **Test seam**: inject a fake `fetch` via the constructor's second arg (this is what the old
    `fetchImpl` param was — now a constructor parameter). Hooks build a service with
    `useMemo(() => new XApiService(config.xUrl), [config.xUrl])`.
- **FR-016** `lib/store/` → `src/store/`. No `lib/store/` remains.
- **FR-017** All imports updated (`@/lib/{agents,feedback,identity}/{client,remote,sink,mock}` →
  `@/lib/{agents,feedback,identity}`; `@/lib/stream/*` → `@/lib/chat/*`; `@/lib/store/*` →
  `@/store/*`); `ARCHITECTURE.md` module map + dependency notes refreshed; stale docs
  referencing `localStorage` history corrected.
- **FR-018** `cn()` stays at `lib/utils.ts` (shadcn convention; non-goal to move).

### Non-functional / boundaries (inherited — must stay true)

- No secrets in the bundle; only `NEXT_PUBLIC_*`. No backend/BFF/auth in the repo.
- Static-export safe: no route handlers in the build (dev mocks stay `.dev.ts`, gated out).
- Every component still forwards `className`; endpoints stay config-driven.
- `lib/` stays a framework-agnostic leaf (no React in transport/stream/history modules).

## Success Criteria *(mandatory)*

- **SC-001** With the dev mock, the sidebar loads page 1, "load more" appends page 2, and a row
  click opens that conversation's messages — verified in `next dev`.
- **SC-002** Unsetting `historyUrl` leaves an empty sidebar and writes nothing to browser storage
  (DevTools → Application shows no history keys).
- **SC-003** `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass; no new `as { … }` casts in
  `lib/`.
- **SC-004** `grep -r "@/lib/stream\|@/lib/store\|history/provider\|history/local"` over `src/`
  returns nothing.
- **SC-005** A brand-new chat appears in the sidebar immediately (optimistic) and is replaced by
  the backend row after the list refetch.

## Non-goals

- No history **write** API, rename, delete, or flags/labels (lakemind has these; out of scope).
- No migration of the streaming **reducer** or replay playback out of `useChat`.
- No change to the chat **entity** shapes (`Message`/`Conversation`) or the SSE/Responses wire
  format — only the history envelope and the module layout change.
- No move of `cn()` out of `lib/utils.ts` (shadcn convention; moving churns 100+ imports for no
  gain — an explicit keep, revisit only if desired).
- No feature-folder (`src/features/*`) migration.

## Assumptions

- The history backend paginates with 1-indexed `page` + `per_page` and returns `total`. If a
  real backend differs, the envelope schema is the single adaptation point.
- **Dependencies**: `@tanstack/react-query@^5` (already present); added for this feature —
  `zustand@^5`, `axios@^1.18`, `react-infinite-scroll-component@^7.2`.

---

## Implementation notes — final decisions (2026-07-03)

Executed decisions that refine / diverge from the draft above (source of truth is the code
+ ADR `docs/design-docs/state-store-and-no-local-history.md`):

1. **Startup is pointer-driven, not "auto-open most recent".** The store's `conversationId`
   starts `null` (nothing opened ⇒ empty screen). On startup `useChat` re-opens the
   pointed-at conversation via `loadHistory(id)`. It does NOT auto-open the newest.
2. **Session pointers ARE persisted to `localStorage`.** `conversationId` + `selectedAgentId`
   persist via zustand `persist` (a tiny pointer, re-fetched from the backend on reload).
   `config` is env-derived and NOT persisted. History *data* is still never cached — the
   "no localStorage" principle is scoped to history data, not the session pointer.
3. **List envelope is snake_case and un-transformed.** `{ items, page, per_page, total }`
   is declared as an entity (`ConversationPageSchema`) and parsed as-is — no client sort,
   no camelCase transform; the backend returns items newest-first.
4. **`load(id)` requires an id.** No "no-id ⇒ most recent" convenience; callers resolve the
   id first (startup uses the stored pointer).
5. **Each `ApiService` subclass declares its own endpoint from `config`** (constructor
   `(config, client?)` → `super(config.xUrl)`); callers pass `config`, not a bare URL.
6. **`useChat` was split** — the Replay subsystem moved to `hooks/chat/use-replay.ts`.

### Addendum (2026-07-06) — queue fixes + persisted/runtime split

Follow-up polish surfaced while reviewing the send queue and history detail contract:

7. **Queue drain is suppressed on teardown.** Aborting the active generation fires
   `onClose("abort")` synchronously, which drains the queue and dispatches the next turn —
   correct for `cancel()` (tested), but `newConversation` / `selectConversation` also abort
   to tear down, and there the queued turn must be *discarded*, not sent. A guard flag around
   the teardown abort now skips the drain for that case (regression tests added). Also removed
   an unreachable branch in the drain (`dequeue` returns `null` only for an empty queue).
8. **`Conversation` split into persisted vs runtime.** `ConversationSchema` is now the
   **persisted/wire** entity — `{ id, messages }` only, exactly what `GET {historyUrl}/{id}`
   returns and parses. The streaming state machine's transient fields moved to a separate
   runtime entity `ChatSessionSchema = ConversationSchema.extend({ activeId, queue, status })`
   (+ `toChatSession(base)` to hydrate a loaded conversation). Rationale: `queue`/`activeId`/
   `status` are never persisted and were forcing the backend to send them just to satisfy the
   parse. Reducer / `useChat` / `useReplay` operate on `ChatSession`; `lib/api` only touches
   the base `Conversation`. Supersedes the single-entity shape in
   `001-chat-mvp/data-model.md` (that doc stays as historical record).
