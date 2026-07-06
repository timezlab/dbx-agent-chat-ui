# Implementation Plan: State store, paginated history & structure refactor

**Spec**: [`spec.md`](./spec.md) · **Status**: Draft (awaiting approval) · **Date**: 2026-07-03

## Technical approach

Three interlocking changes, landed in dependency order: **(1)** the Zustand session store,
**(2)** the read-only paginated history capability on TanStack Query, **(3)** the structural
reorg + cleanup. Each is independently testable (US1/US2/US3/US4).

### 1. Session store — `src/store/session-store.ts`

Plain Zustand singleton (static-export SPA → no SSR hydration to reconcile). Holds:

```ts
interface SessionState {
  config: CapabilityConfig;          // resolveConfig() at init; re-seeded via setConfig
  conversationId: string;            // active conversation id
  selectedAgentId: string | null;    // rides on each chat request
  setConfig(c): void;
  setConversationId(id): void;
  newConversationId(): string;       // mint + set, returns it
  selectAgent(id): void;
}
export const useSessionStore = create<SessionState>()(...)
export function resetSessionStore(config?): void  // test isolation
```

- **Testability contract**: the injection seam is a service instance built from config (or its
  optional injected axios `client`) — no client/provider object plumbing. `useChat` resolves
  `config = options.config ?? storeConfig`; `useAgents` reads/writes `selectedAgentId` through
  the store and calls `new AgentsApiService(config.agentsUrl).list()`. Store-backed hook tests
  call `resetSessionStore()` in `beforeEach`.
- **Config seeding**: `<ChatProvider config?>` seeds `setConfig(config)` once on mount when an
  explicit prop is given (embedding/docs demo); the env path already has the right default.
- **conversationId**: `useChat` remains authoritative for the live `conversation` object; it
  **publishes** id changes to the store (`setConversationId`) on create / `newConversation` /
  `selectConversation` so the rest of the app has one shared read surface. (Publish-to-store,
  not read-from-store, keeps the reducer the single writer and avoids cross-test bleed.)

### 2. Capability layer — `lib/api/` axios `ApiService` classes

Every REST capability lives under `lib/api/` as a subclass of a shared `ApiService` base
(axios + zod), replacing the old `client`/`remote`/`mock`/`sink`/`provider` files and their port
interfaces. Each subclass takes its endpoint URL from `config`; **URL unset ⇒ empty** (guarded in
the method, no request); HTTP/parse error throws, caller swallows → same empty state.

```ts
// lib/api/base.ts
export abstract class ApiService {
  protected readonly client: AxiosInstance;
  constructor(protected readonly baseURL: string | undefined, client?: AxiosInstance) {
    this.client = client ?? axios.create({ baseURL, withCredentials: true,
      headers: { Accept: "application/json" } });
  }
  protected get configured() { return !!this.baseURL; }
  protected async request<T>(schema: ZodType<T>, config: AxiosRequestConfig, label: string): Promise<T> {
    try { return schema.parse((await this.client.request(config)).data); }
    catch (e) { throw normalize(e, label); }           // ZodError/AxiosError → readable Error
  }
  protected async requestOrNull<T>(schema, config, label): Promise<T | null> { /* 404 ⇒ null */ }
  protected async requestVoid(config, label): Promise<void> { /* no body */ }
}

// lib/api/history.ts
const ConversationListResponseSchema = z.object({
  items: ConversationSummarySchema.array().default([]),
  page: z.number().int().positive().default(1),
  per_page: z.number().int().positive().default(DEFAULT_PER_PAGE),
  total: z.number().int().nonnegative().default(0),
});
export interface HistoryPage { items: ConversationSummary[]; page: number; perPage: number; total: number; }
export class HistoryApiService extends ApiService {
  async list({ page, perPage }): Promise<HistoryPage> {
    if (!this.configured) return { items: [], page: 1, perPage, total: 0 };
    const r = await this.request(ConversationListResponseSchema,
      { method: "GET", params: { page, per_page: perPage } }, "HistoryApi.list");
    return { items: [...r.items].sort((a,b)=>b.updatedAt-a.updatedAt), page: r.page, perPage: r.per_page, total: r.total };
  }
  async load(id?: string): Promise<Conversation | null> {
    if (!this.configured) return null;
    if (!id) { const { items } = await this.list({ page: 1, perPage: DEFAULT_PER_PAGE });
      return items.length ? this.load(items[0].id) : null; }
    return this.requestOrNull(ConversationSchema, { method: "GET", url: `/${encodeURIComponent(id)}` }, "HistoryApi.load");
  }
}
export { conversationTitle, summarizeConversation };  // pure helpers
```

`agents.ts`/`feedback.ts`/`identity.ts` follow the same shape (`AgentsApiService.list()→Agent[]`,
`FeedbackApiService.submit(feedback)→void`, `IdentityApiService.me()→Identity|null`; empty/no-op
when unconfigured). `DEFAULT_PER_PAGE = 20`. No `as { … }` casts anywhere — `schema.parse` on the
whole body. **Chat transport is NOT an `ApiService`** (SSE via fetch-event-source) — stays in
`lib/chat/transport.ts`.

**React Query layer** — `src/hooks/chat/use-history.ts` (new). Builds the service from store
config: `const api = useMemo(() => new HistoryApiService(config.historyUrl), [config.historyUrl])`.

```ts
useConversationsInfinite() // useInfiniteQuery
  queryKey: ["history","list", perPage]
  queryFn: ({ pageParam }) => api.list({ page: pageParam, perPage })
  initialPageParam: 1
  getNextPageParam: (last) => last.page * last.perPage < last.total ? last.page + 1 : undefined
  enabled: !!config.historyUrl   // empty sidebar, no fetch, when unset
  → conversations (flattened items), fetchNextPage, hasNextPage, isFetchingNextPage
useConversationDetail(id)  // useQuery, queryFn: () => api.load(id), enabled: !!id
useHistoryMutations()      // invalidate + optimistic prepend helpers (page-1 cache)
```

**Provider wiring** — `src/app/providers.tsx` (new): a `"use client"` `QueryClientProvider`
with a module-singleton `QueryClient`, mounted in `app/layout.tsx` (and reused by the docs
`demo.tsx`). Sensible defaults (`staleTime: 30s`, no window-focus refetch).

**`useChat` deltas**:
- Drop the localStorage-era startup/persist effects and every `save`. Startup: hydrate the
  most-recent via `historyApi.load()` into a pristine session (FR-006); the **sidebar list** is
  owned by `useConversationsInfinite` in the shell.
- On terminal turn: call the optimistic-prepend + invalidate helper (no save).
- `selectConversation(id)`: abort active gen → `historyApi.load(id)` (or read the detail query)
  → `setConversation` + publish `setConversationId(id)`.
- Feedback: `new FeedbackApiService(config.feedbackUrl).submit(feedback)`.
- Test seam: `useChat` accepts optional service instances (or their injected axios `client`)
  instead of `history`/`feedback` provider objects.

**Sidebar** — `app-sidebar.tsx` consumes `useConversationsInfinite` and renders the rows inside
a `<InfiniteScroll>` (`react-infinite-scroll-component`): `dataLength={conversations.length}`,
`next={fetchNextPage}`, `hasMore={hasNextPage}`, a small `loader`, and `scrollableTarget` set to
the sidebar's scroll container (the list scrolls within the sidebar, not the window). Active row
highlighted in place (no hoisting — unchanged rule); a live unsaved chat still gets its temporary
top row.

### 3. Dev mocks (`.dev.ts`, gated out of the export)

- `app/api/history/route.dev.ts` → read `page`/`per_page` from the query string, slice the
  seeded `MOCK_CONVERSATIONS`, return `{ items, page, per_page, total }`. Still `force-static`
  (bare GET under `output: export`); static export serves page 1 — `generateStaticParams` isn't
  applicable to query params, so document that only the first page renders statically in the
  export (dev `next dev` serves all pages). Seed **> per_page** conversations so "load more" is
  exercisable in dev.
- `app/api/history/[conversationId]/route.dev.ts` → return the conversation **directly** (200)
  or `404` (drop the `{ conversation }` wrapper).

### 4. Structure reorg (US3) — moves

| From | To |
|------|----|
| `src/lib/stream/sse-client.ts` (+ `transport.ts`) | merged into `src/lib/chat/transport.ts` |
| `src/lib/stream/responses.ts`, `replay.ts`, `recording.ts`, `recordings/` | `src/lib/chat/…` |
| `src/lib/stream/sse.ts` | **deleted** (dead: `parseRecording`/`extractDataPayloads` only used by its own test; dup of `recording.ts › parseFrames`) |
| `src/lib/{agents,feedback,identity,history}/*` | `src/lib/api/{agents,feedback,identity,history}.ts` + `base.ts` |
| `src/lib/store/session-store.ts` | `src/store/session-store.ts` |

Update every importer (`@/lib/stream/*` → `@/lib/chat/*`; `@/lib/{agents,feedback,identity}/…`
and `@/lib/history` → `@/lib/api/*`; `@/lib/store/*` → `@/store/*`), move the co-located
`__tests__`, and refresh `ARCHITECTURE.md` (promote the "planned" chat modules to real; fold
`lib/stream` into `lib/chat`; add `src/lib/api` + `src/store`). `cn()` stays at `lib/utils.ts`
(documented non-goal).

### 5. Cleanup (US4)

Delete: `stripAttachmentData`, in-memory storage degrade, `withLocalFailover`, `save`
everywhere, the old `{ conversations }`/`{ conversation }` envelope handling and its `as` casts.
Grep-gate: no `as { ` object casts introduced; no dead exports.

## Testing strategy (TDD where behavior is non-trivial)

- **Store**: `store/__tests__/session-store.test.ts` — actions + reset.
- **Capability services** (inject a mock axios `client`, e.g. `axios-mock-adapter` or a stub):
  `lib/api/__tests__/{history,agents,identity,feedback}.test.ts` — paginated envelope parse +
  newest-first, detail direct + 404→null, malformed→throw, empty/no-op when URL unset, POST body
  for feedback. Plus `base.test.ts` for error normalization (ZodError/AxiosError → readable).
- **useInfiniteQuery hook**: `hooks/chat/__tests__/use-history.test.ts` — page accumulation,
  `getNextPageParam` stops at `total`, disabled when no `historyUrl`, optimistic prepend.
- **useChat**: update history/replay/feedback tests to inject `loadHistory`/`submitFeedback`
  function overrides (no `save`; startup hydrate via `loadHistory`); assert publish-to-store on
  new/select.
- **useAgents / useIdentity**: inject `fetchImpl`; selection via store (reset in `beforeEach`).
- Provider wrapper for hook tests: a `QueryClientProvider` test helper (`renderHook` wrapper).

## Rollout / sequencing

1. Store (US2) + reset + tests.
2. History module pagination + envelope + tests (US1 data layer, US4 cleanup).
3. `providers.tsx` + `use-history.ts` (React Query) + tests.
4. Wire `useChat` + `app-sidebar` (infinite scroll, optimistic) + dev mocks.
5. Structure moves (US3) + import sweep + ARCHITECTURE.md + docs (`localStorage` mentions,
   API reference section envelope) + `001-chat-mvp/tasks.md` changelog + ADR.
6. Full verification (typecheck, lint, test) + `next dev` smoke (user-run docker).

## Risks & mitigations

- **Global store vs. test isolation** → hooks prefer injected options; `resetSessionStore()` in
  `beforeEach`; publish-to-store (not read) for conversationId.
- **Static export + paginated mock** → only page 1 renders statically; documented; dev serves all.
- **Import sweep breakage** → move one folder at a time, `pnpm typecheck` after each.
- **React Query in a static SPA** → client-only provider; no server prefetch/hydration.

## ADR

`docs/design-docs/state-store-and-no-local-history.md` — Context (localStorage history was
fragile & "phiền"; scattered client state), Decision (Zustand session store; backend-only
read-only paginated history; no local fallback; `useInfiniteQuery` page-by-page), Alternatives
(keep localStorage cache; grow `per_page` like lakemind; feature-folders), Consequences.
