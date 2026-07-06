# Tasks: State store, paginated history & structure refactor

**Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md) · **Date**: 2026-07-03

Committable units, dependency-ordered. `[P]` = parallelizable with siblings. Each task lists an
observable done-condition. TDD: write/adjust the test in the same task as the behavior.

> **Completed 2026-07-03.** See `spec.md` › _Implementation notes — final decisions_ for
> refinements (pointer-driven startup, persisted session pointers, snake_case envelope,
> `load(id)` required, per-subclass endpoint, `useChat`→`use-replay` split).

## Phase A — Session store (US2)

- [x] **A1** Move `lib/store/session-store.ts` → `src/store/session-store.ts`; final store shape
  (`config`, `conversationId`, `selectedAgentId` + `setConfig`/`setConversationId`/
  `newConversationId`/`selectAgent` + `resetSessionStore`). **Done:** file at `src/store/`, no
  `lib/store/`.
- [x] **A2** `src/store/__tests__/session-store.test.ts` — actions mutate state; `newConversationId`
  returns a fresh id; `resetSessionStore` clears selection. **Done:** tests pass.
- [x] **A3** `providers.tsx` (QueryClientProvider) + mount in `app/layout.tsx`; wrap docs
  `demo.tsx`. **Done:** app renders under one `QueryClient`.
- [x] **A4** Wire `useAgents` selection → store (`selectedAgentId`/`selectAgent`), keep injected
  `client`; `<ChatProvider>` seeds `setConfig` from an explicit prop; `useChat` reads
  `config = options.config ?? storeConfig`. **Done:** agent selection round-trips via store;
  useAgents test resets store in `beforeEach` and passes.

## Phase B — `lib/api/` axios ApiService classes (US1 data + US4)

- [x] **B1** `lib/api/base.ts`: `abstract class ApiService` (axios instance, `withCredentials`,
  `Accept: json`, constructor `(baseURL?, client?)`); protected `request<T>(schema,config,label)`
  (zod parse + `ZodError`/`AxiosError` → readable Error), `requestOrNull<T>` (404⇒null),
  `requestVoid`. **No next-auth/session logic.** + `lib/api/__tests__/base.test.ts`. **Done:** pass.
- [x] **B2** `lib/api/history.ts`: `HistoryApiService.list({page,perPage})→HistoryPage` (envelope
  `ConversationListResponseSchema.parse`, newest-first, `[]`+total 0 when unconfigured),
  `load(id?)→Conversation|null` (`requestOrNull`, no-id→newest); `DEFAULT_PER_PAGE=20`; export
  `conversationTitle`/`summarizeConversation`. Remove `lib/history/`. **Done:** no `as { }` casts.
- [x] **B3** `lib/api/{agents,feedback,identity}.ts`: `AgentsApiService.list()→Agent[]` ([] if
  unset), `FeedbackApiService.submit(feedback)→void` (no-op if unset), `IdentityApiService.me()→
  Identity|null` (null if unset). Delete `lib/{agents,feedback,identity}/` (incl. `mock.ts`,
  port interfaces, `resolve*`). **Done:** one file each under `lib/api/`.
- [x] **B4** `lib/api/__tests__/{history,agents,feedback,identity}.test.ts` (mock axios client):
  parse when configured, empty/no-op when unset, 404→null, malformed→throw, feedback POST body.
  Delete old capability `__tests__`. **Done:** pass.
- [x] **B5** Update consumers: `useAgents` → `new AgentsApiService(config.agentsUrl).list()`,
  `useIdentity` → `IdentityApiService.me()`, `useChat` feedback → `FeedbackApiService.submit()`,
  history hooks → `HistoryApiService`. **Done:** typecheck clean.

## Phase C — React Query history hooks (US1)

- [x] **C1** `hooks/chat/use-history.ts`: `useConversationsInfinite()` (`useInfiniteQuery`,
  `initialPageParam:1`, `getNextPageParam` stops at `page*perPage>=total`, flattens items,
  `enabled: !!config.historyUrl`); `useConversationDetail(id)`; `useHistoryMutations`
  (optimistic prepend page-1 + invalidate). **Done:** hook exists, typed.
- [x] **C2** `hooks/chat/__tests__/use-history.test.ts` (QueryClientProvider wrapper): page
  accumulation, next-page stop at total, disabled without `historyUrl`, optimistic prepend
  replaces on invalidate. **Done:** tests pass.

## Phase D — Chat wiring (US1)

- [x] **D1** `useChat`: remove localStorage-era startup/persist effects and `history.save`;
  startup hydrates most-recent via `history.load()` into a pristine session (FR-006); terminal
  turn calls optimistic-prepend+invalidate; `newConversation`/`selectConversation` publish
  `conversationId` to the store. **Done:** use-chat history/replay/feedback tests updated & pass.
- [x] **D2** `app-sidebar.tsx`: consume `useConversationsInfinite`; wrap rows in
  `<InfiniteScroll>` (`react-infinite-scroll-component`) with `dataLength`/`next=fetchNextPage`/
  `hasMore=hasNextPage`/`loader`/`scrollableTarget`; active row highlighted in place; live unsaved
  chat keeps its temporary top row. **Done:** sidebar renders paginated list; `next dev` load-more works.

## Phase E — Dev mocks (US1)

- [x] **E1** `app/api/history/route.dev.ts`: read `page`/`per_page`, slice seeded conversations,
  return `{ items, page, per_page, total }`; seed **> per_page** rows. **Done:** mock returns an
  envelope; page 2 differs from page 1.
- [x] **E2** `app/api/history/[conversationId]/route.dev.ts`: return the conversation directly
  (200) or `404` (drop `{ conversation }` wrapper). **Done:** detail route returns bare object.

## Phase F — Structure reorg (US3)

- [x] **F1** Move `lib/stream/{sse,sse-client,responses,replay,recording}.ts` + `recordings/` →
  `lib/chat/`; move co-located `__tests__`. **Done:** no `lib/stream/` folder.
- [x] **F2** Import sweep: `@/lib/stream/*` → `@/lib/chat/*`, `@/lib/store/*` → `@/store/*`.
  **Done:** `grep` finds no old paths; `pnpm typecheck` clean.

## Phase G — Docs & cleanup (US3/US4)

- [x] **G1** ADR `docs/design-docs/state-store-and-no-local-history.md` (Context/Decision/
  Alternatives/Consequences). **Done:** ADR committed.
- [x] **G2** `ARCHITECTURE.md` module map refreshed (chat modules real; `lib/stream` folded;
  `src/store` added; history one module). **Done:** no stale/planned paths.
- [x] **G3** Fix `localStorage` history mentions: `entities/config.ts`, `env.ts`,
  `docs/sections/configuration.tsx`, `docs/sections/api-docs.tsx` (new paginated envelope +
  bare-detail contract). **Done:** grep for "localStorage" over history docs is clean/correct.
- [x] **G4** Changelog entry in `001-chat-mvp/tasks.md` referencing this feature. **Done:** dated
  note appended.

## Phase H — Verification

- [x] **H1** `pnpm typecheck` + `pnpm lint` + `pnpm test` all green; no new `as { }` casts in
  `lib/`; SC-004 grep clean. **Done:** all gates pass.
- [x] **H2** `next dev` smoke (user-run docker): sidebar page-1 load, load-more, row-open, empty
  sidebar when `historyUrl` unset. **Done:** user confirms.

## Phase I — Follow-up polish (2026-07-06)

Added while reviewing the send queue + history detail contract (see spec.md addendum items 7–8).

- [x] **I1** Suppress the queue drain on teardown: `newConversation` / `selectConversation`
  abort to LEAVE the conversation, so the queued turn must be discarded, not dispatched to the
  backend. Guard flag (`suppressQueueDrainRef`) set around the teardown abort; `cancel()` still
  drains (intended). Removed the unreachable `snapshot.queue.length > 0` branch in the drain.
  **Done:** 2 regression tests in `use-chat.cancel.test.ts` (New chat / Select don't send the
  queued turn); `state.sends` unchanged after teardown.
- [x] **I2** Split `Conversation` (persisted, `{ id, messages }`) from `ChatSession`
  (runtime = base + `activeId`/`queue`/`status`) in `entities/conversation.ts`; add
  `toChatSession(base)`. Reducer / `useChat` / `useReplay` → `ChatSession`; `lib/api` +
  history load → base `Conversation`; dev mock seed drops runtime fields. **Done:** typecheck
  clean (bar pre-existing `replay.test.ts` error), 235 tests pass.
- [x] **I3** `docs/sections/api-docs.tsx`: each endpoint shows a `Types` (TypeScript) block
  before its example; history detail documents base `Conversation` (`{ id, messages }`) + full
  `Message`/`MessagePart`/`ToolActivityItem`/`MessageFeedback`; chat request documents
  `conversationId` + per-turn `attachments`; SSE example corrected (function_call pairing,
  `message`/`[DONE]` terminals, ignored lifecycle frames). **Done:** lint clean.
